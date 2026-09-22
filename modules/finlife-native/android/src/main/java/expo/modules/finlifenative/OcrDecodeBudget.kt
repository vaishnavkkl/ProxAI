package expo.modules.finlifenative

/** Bound the allocation before decoding, including square and very wide photos. */
internal object OcrDecodeBudget {
  const val CHAT_MAX_EDGE = 2560
  const val CHAT_MAX_PIXELS = 3L * 1024 * 1024

  fun sampleSize(width: Int, height: Int, maxEdge: Int, maxPixels: Long): Int {
    require(width > 0 && height > 0 && maxEdge > 0 && maxPixels > 0)
    var sample = 1
    while (true) {
      val w = (width.toLong() + sample - 1) / sample
      val h = (height.toLong() + sample - 1) / sample
      if (maxOf(w, h) <= maxEdge && w * h <= maxPixels) return sample
      check(sample <= Int.MAX_VALUE / 2) { "Image dimensions are too large" }
      sample *= 2
    }
  }
}

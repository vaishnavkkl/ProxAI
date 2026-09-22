package expo.modules.finlifenative

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class OcrDecodeBudgetTest {
  @Test fun boundsPhotosBeforeAllocation() {
    for ((width, height) in listOf(8000 to 6000, 4096 to 4096, 100000 to 1000, 4033 to 3025, Int.MAX_VALUE to Int.MAX_VALUE)) {
      val sample = OcrDecodeBudget.sampleSize(width, height, OcrDecodeBudget.CHAT_MAX_EDGE, OcrDecodeBudget.CHAT_MAX_PIXELS)
      val w = (width.toLong() + sample - 1) / sample
      val h = (height.toLong() + sample - 1) / sample
      assertTrue(w * h <= OcrDecodeBudget.CHAT_MAX_PIXELS)
      assertTrue(maxOf(w, h) <= OcrDecodeBudget.CHAT_MAX_EDGE)
      assertEquals(0, sample and (sample - 1))
    }
  }

  @Test fun keepsPhoneScreenshotsAndSmallImagesSharp() {
    assertEquals(1, OcrDecodeBudget.sampleSize(1080, 2400, OcrDecodeBudget.CHAT_MAX_EDGE, OcrDecodeBudget.CHAT_MAX_PIXELS))
    assertEquals(1, OcrDecodeBudget.sampleSize(640, 480, OcrDecodeBudget.CHAT_MAX_EDGE, OcrDecodeBudget.CHAT_MAX_PIXELS))
    assertEquals(4, OcrDecodeBudget.sampleSize(8000, 6000, OcrDecodeBudget.CHAT_MAX_EDGE, OcrDecodeBudget.CHAT_MAX_PIXELS))
  }

  @Test(expected = IllegalArgumentException::class) fun rejectsInvalidDimensions() {
    OcrDecodeBudget.sampleSize(-1, 10, OcrDecodeBudget.CHAT_MAX_EDGE, OcrDecodeBudget.CHAT_MAX_PIXELS)
  }
}

import Darwin
import ExpoModulesCore

public class FinlifeNativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FinlifeNative")

    AsyncFunction("getMemorySnapshot") { () -> [String: Double] in
      let total = Double(ProcessInfo.processInfo.physicalMemory)
      var info = mach_task_basic_info()
      var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4
      let result = withUnsafeMutablePointer(to: &info) { pointer in
        pointer.withMemoryRebound(to: integer_t.self, capacity: Int(count)) { rebound in
          task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), rebound, &count)
        }
      }
      let resident = result == KERN_SUCCESS ? Double(info.resident_size) : 0
      return [
        "totalBytes": total,
        "availBytes": max(0, total - resident),
        "nativeHeapBytes": resident,
        "javaUsedBytes": 0,
      ]
    }

    AsyncFunction("getTodaysInbox") { () -> [[String: String]] in
      []
    }

    AsyncFunction("getCalendarEvents") { (_ startMillis: Double, _ endMillis: Double, _ limit: Double, _ account: String) -> [[String: String]] in
      []
    }

    AsyncFunction("getCalendarAccounts") { () -> [String] in
      []
    }

    AsyncFunction("filterInstalledPackages") { (_ packages: [String]) -> [String] in
      []
    }
  }
}

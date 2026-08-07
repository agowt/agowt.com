// YoustoCalendar.swift
// Native module that presents EKEventEditViewController — the native iOS calendar
// event creation dialog — with pre-filled event data from Yousto.
//
// No calendar permissions are requested in advance; iOS handles permission
// implicitly when the user taps "Add" in the native dialog.
//
// ─── Xcode setup ───────────────────────────────────────────────────────────
// 1. In Xcode, File > Add Files to "YoustoApp" > select this file
// 2. Also add YoustoCalendar.m to the same target
// 3. If a YoustoApp-Bridging-Header.h does not exist, Xcode will offer to
//    create one automatically when you add the .m file — accept it.
// 4. Rebuild (Cmd+R). NativeModules.YoustoCalendar will then be defined.

import Foundation
import EventKit
import EventKitUI
import UIKit

// Retain the delegate for the lifetime of the presented view controller.
private var calendarDelegateKey = "calendarDelegate"

@objc(YoustoCalendar)
class YoustoCalendar: NSObject {

  // React Native calls module methods on a background thread by default.
  // We need the main queue for UIKit operations.
  @objc static func requiresMainQueueSetup() -> Bool { return false }

  @objc
  func presentEventCreationDialog(
    _ eventData: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      let store = EKEventStore()
      let event = EKEvent(eventStore: store)

      // ── Title ────────────────────────────────────────────────────────────
      event.title = eventData["title"] as? String ?? "Event"

      // ── Start date ───────────────────────────────────────────────────────
      if let dateStr = eventData["startDate"] as? String {
        // Try ISO 8601 with timezone offset first (most common from JS Date.toISOString())
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [
          .withInternetDateTime,
          .withDashSeparatorInDate,
          .withColonSeparatorInTime,
          .withTimeZone,
        ]
        if let date = isoFormatter.date(from: dateStr) {
          event.startDate = date
        } else {
          // Fallback: plain datetime without timezone (e.g. "2025-03-18T09:00:00")
          let fallbackFormatter = DateFormatter()
          fallbackFormatter.locale = Locale(identifier: "en_US_POSIX")
          fallbackFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
          event.startDate = fallbackFormatter.date(from: dateStr) ?? Date().addingTimeInterval(86400)
        }
      } else {
        // No date extracted — default to tomorrow at 9 AM
        var components = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        components.day = (components.day ?? 1) + 1
        components.hour = 9
        components.minute = 0
        event.startDate = Calendar.current.date(from: components) ?? Date().addingTimeInterval(86400)
      }

      // Default 1-hour duration
      event.endDate = event.startDate.addingTimeInterval(3600)

      // ── Notes / description ───────────────────────────────────────────────
      if let notes = eventData["notes"] as? String, !notes.isEmpty {
        event.notes = notes
      }

      // ── Present EKEventEditViewController ─────────────────────────────────
      let editVC = EKEventEditViewController()
      editVC.event = event
      editVC.eventStore = store

      // Create delegate and retain it on the view controller via associated object
      let delegate = CalendarEditDelegate(resolve: resolve, reject: reject)
      editVC.editViewDelegate = delegate
      objc_setAssociatedObject(
        editVC,
        &calendarDelegateKey,
        delegate,
        .OBJC_ASSOCIATION_RETAIN_NONATOMIC
      )

      // Find the top-most presented view controller to present from
      guard let scene = UIApplication.shared.connectedScenes
              .compactMap({ $0 as? UIWindowScene })
              .first(where: { $0.activationState == .foregroundActive }),
            let rootVC = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController
      else {
        reject("NO_ROOT_VC", "Could not find root view controller", nil)
        return
      }

      var topVC = rootVC
      while let presented = topVC.presentedViewController {
        topVC = presented
      }

      topVC.present(editVC, animated: true, completion: nil)
    }
  }
}

// ── EKEventEditViewDelegate ────────────────────────────────────────────────────
// Captures the result when the user taps "Add", "Cancel", or "Delete".

private class CalendarEditDelegate: NSObject, EKEventEditViewDelegate {
  private let resolve: RCTPromiseResolveBlock
  private let reject: RCTPromiseRejectBlock

  init(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    self.resolve = resolve
    self.reject = reject
  }

  func eventEditViewController(
    _ controller: EKEventEditViewController,
    didCompleteWith action: EKEventEditViewAction
  ) {
    controller.dismiss(animated: true, completion: nil)

    switch action {
    case .saved:
      resolve(["action": "saved"])
    case .canceled:
      resolve(["action": "canceled"])
    case .deleted:
      resolve(["action": "deleted"])
    @unknown default:
      resolve(["action": "unknown"])
    }
  }
}

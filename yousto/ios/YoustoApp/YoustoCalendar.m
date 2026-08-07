// YoustoCalendar.m
// Complete Objective-C implementation of the Yousto calendar native module.
// Presents EKEventEditViewController (native iOS "New Event" dialog) with
// pre-filled event data. No calendar permissions requested from JS —
// iOS handles permission implicitly when the user taps "Add".
//
// Pure ObjC: no Swift file, no bridging header required.

#import <React/RCTBridgeModule.h>
@import EventKit;
@import EventKitUI;
@import UIKit;
#import <objc/runtime.h>

// ── Delegate ──────────────────────────────────────────────────────────────────
// Captures the user's action (Add / Cancel / Delete) and resolves the JS promise.

@interface YoustoCalendarDelegate : NSObject <EKEventEditViewDelegate>
@property (nonatomic, copy) RCTPromiseResolveBlock resolve;
@property (nonatomic, copy) RCTPromiseRejectBlock  reject;
@end

@implementation YoustoCalendarDelegate

- (void)eventEditViewController:(EKEventEditViewController *)controller
          didCompleteWithAction:(EKEventEditViewAction)action {
  [controller dismissViewControllerAnimated:YES completion:nil];

  switch (action) {
    case EKEventEditViewActionSaved:
      self.resolve(@{@"action": @"saved"});
      break;
    case EKEventEditViewActionCanceled:
      self.resolve(@{@"action": @"canceled"});
      break;
    case EKEventEditViewActionDeleted:
      self.resolve(@{@"action": @"deleted"});
      break;
    default:
      self.resolve(@{@"action": @"unknown"});
      break;
  }
}

@end

// ── Module ────────────────────────────────────────────────────────────────────

@interface YoustoCalendar : NSObject <RCTBridgeModule>
@end

@implementation YoustoCalendar

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(presentEventCreationDialog:(NSDictionary *)eventData
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{

    EKEventStore *store = [[EKEventStore alloc] init];
    EKEvent      *event = [EKEvent eventWithEventStore:store];

    // ── Title ─────────────────────────────────────────────────────────────
    event.title = eventData[@"title"] ?: @"Event";

    // ── Start date ────────────────────────────────────────────────────────
    NSString *dateStr = eventData[@"startDate"];
    if (dateStr && dateStr.length > 0) {
      NSISO8601DateFormatter *fmt = [[NSISO8601DateFormatter alloc] init];
      NSDate *parsed = [fmt dateFromString:dateStr];
      // Fallback: strip timezone suffix and try plain datetime
      if (!parsed) {
        NSDateFormatter *plain = [[NSDateFormatter alloc] init];
        plain.locale = [NSLocale localeWithLocaleIdentifier:@"en_US_POSIX"];
        plain.dateFormat = @"yyyy-MM-dd'T'HH:mm:ss";
        parsed = [plain dateFromString:dateStr];
      }
      event.startDate = parsed ?: [NSDate dateWithTimeIntervalSinceNow:86400];
    } else {
      // No date — default to tomorrow at 09:00
      NSCalendar *cal = [NSCalendar currentCalendar];
      NSDateComponents *comps = [cal components:NSCalendarUnitYear | NSCalendarUnitMonth | NSCalendarUnitDay
                                       fromDate:[NSDate date]];
      comps.day  += 1;
      comps.hour  = 9;
      comps.minute = 0;
      comps.second = 0;
      NSDate *tomorrow = [cal dateFromComponents:comps];
      event.startDate = tomorrow ?: [NSDate dateWithTimeIntervalSinceNow:86400];
    }

    // Default 1-hour block
    event.endDate = [event.startDate dateByAddingTimeInterval:3600];

    // ── Notes ─────────────────────────────────────────────────────────────
    NSString *notes = eventData[@"notes"];
    if (notes && notes.length > 0) {
      event.notes = notes;
    }

    // ── Build and present EKEventEditViewController ────────────────────────
    YoustoCalendarDelegate *delegate = [[YoustoCalendarDelegate alloc] init];
    delegate.resolve = resolve;
    delegate.reject  = reject;

    EKEventEditViewController *editVC = [[EKEventEditViewController alloc] init];
    editVC.event            = event;
    editVC.eventStore       = store;
    editVC.editViewDelegate = delegate;

    // Retain delegate for the view controller's lifetime via associated object
    static char kDelegateKey;
    objc_setAssociatedObject(editVC, &kDelegateKey, delegate, OBJC_ASSOCIATION_RETAIN_NONATOMIC);

    // Find topmost presented view controller
    UIWindowScene *activeScene = nil;
    for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
      if ([scene isKindOfClass:[UIWindowScene class]] &&
          scene.activationState == UISceneActivationStateForegroundActive) {
        activeScene = (UIWindowScene *)scene;
        break;
      }
    }

    UIViewController *rootVC = activeScene.windows.firstObject.rootViewController;
    if (!rootVC) {
      reject(@"NO_ROOT_VC", @"Could not find root view controller", nil);
      return;
    }

    UIViewController *topVC = rootVC;
    while (topVC.presentedViewController) {
      topVC = topVC.presentedViewController;
    }

    [topVC presentViewController:editVC animated:YES completion:nil];
  });
}

@end

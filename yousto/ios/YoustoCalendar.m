// YoustoCalendar.m
// Programmatically adds events to iOS Calendar using EKEventStore.
// Works on both Simulator and real device — no EKEventEditViewController needed.
// Requests write-only access (iOS 17+) or full access (iOS ≤16).
// Returns eventIdentifier on success for future Calendar deep-linking.
//
// Pure ObjC — no Swift, no bridging header required.

#import <React/RCTBridgeModule.h>
@import EventKit;
@import UIKit;

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

    // ── Permission request ────────────────────────────────────────────────────
    // Use write-only access on iOS 17+ (least-privilege principle),
    // fall back to full access on older OS versions.

    void (^addEventBlock)(void) = ^{
      // ── Build the EKEvent ───────────────────────────────────────────────────
      EKEvent *event = [EKEvent eventWithEventStore:store];

      // Title
      event.title = eventData[@"title"] ?: @"Event";

      // Start date — parse ISO-8601 string from JS
      NSString *dateStr = eventData[@"startDate"];
      if (dateStr && [dateStr isKindOfClass:[NSString class]] && dateStr.length > 0) {
        // Try ISO8601 formatter first (handles Z and +HH:MM offsets)
        NSISO8601DateFormatter *isoFmt = [[NSISO8601DateFormatter alloc] init];
        NSDate *parsed = [isoFmt dateFromString:dateStr];

        // Fallback: plain "yyyy-MM-dd'T'HH:mm:ss" without timezone
        if (!parsed) {
          NSDateFormatter *plain = [[NSDateFormatter alloc] init];
          plain.locale   = [NSLocale localeWithLocaleIdentifier:@"en_US_POSIX"];
          plain.timeZone = [NSTimeZone localTimeZone];
          plain.dateFormat = @"yyyy-MM-dd'T'HH:mm:ss";
          parsed = [plain dateFromString:dateStr];
        }

        if (parsed) {
          event.startDate = parsed;
          event.endDate   = [parsed dateByAddingTimeInterval:3600]; // 1-hour block
          event.allDay    = NO;
        }
      }

      // If no valid date was parsed, default to tomorrow all-day
      if (!event.startDate) {
        NSCalendar *cal = [NSCalendar currentCalendar];
        NSDateComponents *comps = [NSDateComponents new];
        comps.day = 1;
        NSDate *tomorrow = [cal dateByAddingComponents:comps toDate:[NSDate date] options:0];
        event.startDate = tomorrow;
        event.endDate   = tomorrow;
        event.allDay    = YES;
      }

      // Notes / description
      NSString *notes = eventData[@"notes"];
      if (notes && [notes isKindOfClass:[NSString class]] && notes.length > 0) {
        event.notes = notes;
      }

      // Location
      NSString *location = eventData[@"location"];
      if (location && [location isKindOfClass:[NSString class]] && location.length > 0) {
        event.location = location;
      }

      // Calendar — write to the user's default calendar
      event.calendar = store.defaultCalendarForNewEvents;

      // ── Save ────────────────────────────────────────────────────────────────
      NSError *saveError = nil;
      BOOL saved = [store saveEvent:event span:EKSpanThisEvent error:&saveError];

      if (!saved || saveError) {
        reject(@"SAVE_FAILED",
               saveError.localizedDescription ?: @"Failed to save event to Calendar",
               saveError);
        return;
      }

      NSString *eventId = event.eventIdentifier ?: @"";
      NSLog(@"[YoustoCalendar] Event saved: %@ (id: %@)", event.title, eventId);
      resolve(@{ @"action": @"saved", @"eventIdentifier": eventId });
    };

    // ── iOS 17+ write-only access ─────────────────────────────────────────────
    if (@available(iOS 17.0, *)) {
      [store requestWriteOnlyAccessToEventsWithCompletion:^(BOOL granted, NSError *error) {
        if (!granted || error) {
          reject(@"PERMISSION_DENIED",
                 error.localizedDescription ?: @"Calendar write permission denied",
                 error);
          return;
        }
        dispatch_async(dispatch_get_main_queue(), addEventBlock);
      }];
    } else {
      // ── iOS ≤16 full access ─────────────────────────────────────────────────
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
      [store requestAccessToEntityType:EKEntityTypeEvent completion:^(BOOL granted, NSError *error) {
        if (!granted || error) {
          reject(@"PERMISSION_DENIED",
                 error.localizedDescription ?: @"Calendar permission denied",
                 error);
          return;
        }
        dispatch_async(dispatch_get_main_queue(), addEventBlock);
      }];
#pragma clang diagnostic pop
    }
  });
}

@end

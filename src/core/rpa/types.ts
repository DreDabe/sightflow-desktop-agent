// Identifies the target application the engine is automating.
//
// `wechat` and `wework` are the historical native targets that default to VLM
// layout measurement. The remaining values default to manual box-selection
// measurement.
export type AppType = 'wechat' | 'wework' | 'dingtalk' | 'lark' | 'slack' | 'telegram' | 'generic'

// Which capture strategy the engine should use.
// - `auto`: smart default — VLM for wechat/wework, box-select for others.
// - `vlm`: force VLM layout measurement (only valid for wechat/wework).
// - `box-select`: force manual box selection; opens the wizard if no regions
//   are saved yet.
export type CaptureStrategy = 'auto' | 'vlm' | 'box-select'

export interface ScreenRect {
  x: number
  y: number
  width: number
  height: number
}

// Region rectangles drawn by the user during the box-select wizard.
// Coordinates are absolute screen pixels in logical units (matching
// `event.clientX/Y` and `screen.getDisplayMatching` conventions);
// capture sites multiply by `scaleFactor` for `desktopCapturer` cropping.
//
// Semantic mirror of the WeChat 4-region model:
// - `contactList`     ≈ chatEntranceArea (red-dot scan + click target)
// - `chatMain`        = chatMainArea (diff baseline + provider screenshot)
// - `inputBox`        = messageInputArea (paste + Enter target)
// - `unreadIndicator` ≈ optional refinement of contactList for red-dot detection;
//   when null, hasUnreadMessage falls back to chatMain pixel-diff signaling
//   (used for apps with non-red badges like Slack/Telegram).
export interface BoxRegions {
  contactList: ScreenRect
  chatMain: ScreenRect
  inputBox: ScreenRect
  unreadIndicator: ScreenRect | null
  displayId?: number
  scaleFactor?: number
  capturedAt: number
}

// Whether wechat/wework — i.e. VLM-supported native targets.
export function isWechatLike(appType: AppType): boolean {
  return appType === 'wechat' || appType === 'wework'
}

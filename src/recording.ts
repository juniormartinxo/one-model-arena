// Recording mode takes the whole screen; leaving full screen (Esc) leaves recording too.
export function enterFullscreen() {
  if (!document.fullscreenElement)
    document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
}
export function exitFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

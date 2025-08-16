// utils/notifyPolicy.js
// タイマー画面が表示中は前景バナーを抑止。その他の画面/背景では表示。
let showTimerFinishBannerInForeground = true;

export const setShowTimerFinishBannerInForeground = (v) => {
  showTimerFinishBannerInForeground = !!v;
};

export const getShowTimerFinishBannerInForeground = () => showTimerFinishBannerInForeground;

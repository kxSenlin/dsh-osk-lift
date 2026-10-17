/* dsh-osk-lift —— 屏幕键盘弹出时，把界面压到屏幕上半部分
 *
 * 为什么需要它：Android 的输入法是系统级 IME，弹出时窗口会收到 adjustResize/adjustPan，
 * 应用自己让开。Linux 桌面（含 SteamOS 的 Steam 键盘）的键盘只是一个覆盖窗口，
 * 不改变网页窗口大小，网页根本不知道被挡住了 —— 只能由网页自己判断
 * "有输入框获得焦点"然后把自己压到上半屏。
 *
 * 触发：任意文本框（textarea / input / contenteditable）获得焦点
 *        → 界面高度压到 VISIBLE_RATIO（默认 45%），底部整块留给键盘
 * 收起：点击输入框以外的区域、或按 Esc
 */
(() => {
  if (window.__dshOskLift) return;
  window.__dshOskLift = true;

  /** 键盘弹出后，界面占屏幕的比例（0.45 = 上面 45%） */
  const VISIBLE_RATIO = 0.45;
  const TEXT_TYPES = /^(text|search|url|email|tel|number|password|date|datetime-local|month|time|week)?$/i;

  let composer = null;
  let container = null;

  const isTextControl = (el) => {
    if (!el || el.nodeType !== 1) return false;
    if (el.isContentEditable) return true;
    if (el.tagName === "TEXTAREA") return true;
    if (el.tagName === "INPUT") return TEXT_TYPES.test(el.type || "text");
    return false;
  };

  /** 找"包含发送键的那一层"（也就是整个输入区），用来判断点击是否落在输入区里。
   *  以前按宽度猜，输入区只有半屏宽时会猜错，点到发送键就误判成"点外面"，界面于是收起。 */
  const SEND_SELECTOR =
    '[aria-label="发送消息"],[aria-label="停止生成"],[aria-label="排队发送"],[aria-label="插话发送"]';

  const findContainer = (el) => {
    const limit = window.innerWidth * 0.55;
    let node = el.parentElement;
    let widthMatch = null;
    while (node && node !== document.body && node !== document.documentElement) {
      if (node.querySelector?.(SEND_SELECTOR)) return node; // 输入区里能点到发送键 → 这就是输入区
      if (!widthMatch && node.getBoundingClientRect().width >= limit) widthMatch = node;
      node = node.parentElement;
    }
    return widthMatch ?? el;
  };

  const root = () => document.getElementById("root");

  /** 先试"压缩"；如果界面内部写死了视口高度压不下去，退回"整体上移" */
  const chooseMode = () => {
    const body = document.body;
    const el = root();
    body.classList.remove("dsh-osk-lift", "dsh-osk-lift-shift");
    if (!el) return;
    const prevTransition = el.style.transition;
    el.style.transition = "none"; // 量尺寸时不要被过渡动画干扰
    body.classList.add("dsh-osk-lift");
    void el.offsetHeight;
    const squeezed = el.getBoundingClientRect().height;
    const inner = el.firstElementChild;
    const innerHeight = inner ? inner.getBoundingClientRect().height : 0;
    el.style.transition = prevTransition;
    if (innerHeight > squeezed + 4) {
      body.classList.remove("dsh-osk-lift");
      body.classList.add("dsh-osk-lift-shift");
    }
  };

  const lift = () => {
    const height = (window.visualViewport?.height ?? window.innerHeight) * VISIBLE_RATIO;
    document.documentElement.style.setProperty("--dsh-osk-h", `${Math.round(height)}px`);
    chooseMode();
  };

  const unlift = () => {
    document.body.classList.remove("dsh-osk-lift", "dsh-osk-lift-shift");
    document.documentElement.style.removeProperty("--dsh-osk-h");
  };

  const isLifted = () =>
    document.body.classList.contains("dsh-osk-lift") ||
    document.body.classList.contains("dsh-osk-lift-shift");

  document.addEventListener(
    "focusin",
    (event) => {
      const target = event.target;
      if (!isTextControl(target)) return;
      composer = target;
      container = findContainer(target);
      lift();
    },
    true,
  );

  /** 点击是否落在"输入区"（输入框本体、它的容器、或容器里的按钮）里 */
  const insideComposer = (target) =>
    !!composer &&
    (target === composer ||
      (container && container.contains(target)) ||
      (target instanceof Element && !!target.closest("form")));

  /** 是不是"按钮类"控件：这类元素的点击不能被打断 */
  const isControl = (target) =>
    target instanceof Element &&
    !!target.closest(
      'button, [role="button"], a, select, summary, [aria-haspopup], [aria-expanded], [contenteditable="false"]',
    );

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!composer) return;
      const target = event.target;

      // 点按钮类控件时一律不改布局：界面高度一变，手指底下的按钮会弹走，
      // 浏览器就认为"按下和抬起不在同一个元素上"，这次点击被吞掉 —— 发送键、
      // 麦克风点不动就是这么来的。控件的收起判断交给下面的 click 事件。
      if (isControl(target)) return;

      if (insideComposer(target)) {
        // 点回输入框本身（收起状态下）→ 重新抬起
        if (!isLifted() && isTextControl(target)) lift();
        return;
      }

      unlift(); // 点别处才恢复原样；保留 composer 引用，方便再点回来
    },
    true,
  );

  // 点了输入区外面的按钮（新会话、侧栏、设置…）：先让点击跑完，再收起界面
  document.addEventListener(
    "click",
    (event) => {
      if (!composer || !isLifted()) return;
      const target = event.target;
      if (isControl(target) && !insideComposer(target)) unlift();
    },
    true,
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && isLifted()) unlift();
    },
    true,
  );

  // 窗口尺寸变了就按新高度重算
  window.addEventListener("resize", () => {
    if (isLifted()) lift();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") unlift();
  });
})();

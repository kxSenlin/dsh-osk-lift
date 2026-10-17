/**
 * dsh-osk-lift —— 键盘弹出时把界面压到上半屏 + 放大发送键的可点范围
 *
 * 为什么需要它：Android 的输入法是系统级 IME，弹出时窗口会收到 adjustResize；
 * Linux 桌面（含 SteamOS 的 Steam 键盘）的键盘只是一个覆盖窗口，不改变窗口大小，
 * 网页不知道被挡住了。所以由这个插件在网页里判断"有输入框获得焦点"，
 * 然后把自己压到屏幕上方，把下面整块让给键盘。
 *
 * 实现方式：监听 webserver 的 index 注入事件（webserver/index-inject），
 * 把同目录下的 osk-lift.css / osk-lift.js 注入页面。**不修改 dsh 安装目录里的任何文件**，
 * 所以 dsh 升级不会丢；改样式也只需要改这两个文件 + 刷新页面（不用重启 dsh）。
 */
import { readFileSync } from "node:fs";
import { appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

export const name = "osk-lift";

/** webServer 服务必须先就绪，才能拿到 index 注入事件 */
export const inject = ["webServer"];

const HERE = dirname(fileURLToPath(import.meta.url));

/** 读注入文件；文件暂时不在就跳过，不影响页面 */
const read = (file) => {
  try {
    return readFileSync(join(HERE, file), "utf8");
  } catch {
    return "";
  }
};

/**
 * 每次渲染 index 时现读文件，所以改完 CSS/JS 刷一下页面就生效。
 * 用事件而不是改文件：插件卸载后页面立即恢复原样。
 */
export function apply(ctx) {
  ctx.on("webserver/index-inject", (table) => {
    const css = read("osk-lift.css");
    const js = read("osk-lift.js");
    if (css) table.push({ kind: "style", text: css });
    if (js) table.push({ kind: "script", placement: "body", text: js });
  });

  try {
    appendFileSync(
      join(homedir(), ".dsh", "osklift", "load.log"),
      `${new Date().toISOString()} plugin loaded (pid ${process.pid})\n`,
    );
  } catch {
    /* 记录失败不影响功能 */
  }
}

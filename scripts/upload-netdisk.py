#!/usr/bin/env python3
"""上传文件到公共网盘 tc.qdqqd.com（柯艺云）。

用法: /home/z/.venv/bin/python scripts/upload-netdisk.py <文件路径>

流程（沿用 Task 10 验证过的打法）:
  1. 拦截第三方广告/统计域，加速首屏
  2. 找到文件输入框 set_input_files
  3. 等待上传完成，从页面提取外链（file.ljcdn.com 等）
"""
import asyncio
import re
import sys

from playwright.async_api import async_playwright

AD_HOST_PATTERNS = [
    r"(doubleclick|googlesyndication|google-analytics|googletagmanager)\.",
    r"adservice\.|adserver|ad-|\.ads\.",
    r"(cnzz|baidu.*hm\.baidu|51\.la|umeng)",
    r"tanx\.com|alicdn\.com/app\.",
    r"jqimd\.com|v\.gd|s\.3\.cn",
]

def is_ad(url: str) -> bool:
    return any(re.search(p, url, re.I) for p in AD_HOST_PATTERNS)

async def main(path: str) -> int:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent=(
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
            ),
        )

        captured_links: list[str] = []
        upload_responses: list[str] = []

        async def route_handler(route):
            url = route.request.url
            if is_ad(url):
                await route.abort()
                return
            await route.continue_()

        await ctx.route("**/*", route_handler)

        page = await ctx.new_page()

        def sniff_link(text: str):
            for m in re.findall(r"https?://[^\s\"'<>]+", text or ""):
                if any(k in m for k in ("ljcdn", "qdqqd", "sinan")) and m not in captured_links:
                    captured_links.append(m)

        page.on("response", lambda r: upload_responses.append(f"{r.status} {r.url}") if "upload" in r.url.lower() else None)

        print("[1] 打开网盘首页…")
        await page.goto("https://tc.qdqqd.com/", wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(2500)
        sniff_link(await page.content())

        print("[2] 寻找文件输入框…")
        inputs = page.locator("input[type=file]")
        count = await inputs.count()
        print(f"    input[type=file] x{count}")
        if count == 0:
            # 有些站点把 input 藏在 label/按钮后面，尝试点击常见上传入口
            for sel in ["text=上传文件", "text=点击上传", "text=选择文件", ".upload-btn", "#upload"]:
                try:
                    await page.click(sel, timeout=1500)
                    break
                except Exception:
                    continue
            await page.wait_for_timeout(1200)
            count = await inputs.count()
        if count == 0:
            html = (await page.content())[:3000]
            print("    未找到上传框，页面片段：", html[:800])
            await browser.close()
            return 2

        print(f"[3] 上传 {path} …")
        async with page.expect_response(lambda r: "upload" in r.url.lower(), timeout=180000) as resp_info:
            await inputs.first.set_input_files(path)
        try:
            resp = await resp_info.value
            print(f"    上传响应: {resp.status} {resp.url}")
            body = await resp.text()
            print("    响应体:", body[:300])
            sniff_link(body)
        except Exception as e:
            print("    (上传响应监听超时/异常:", e, ")")

        print("[4] 等待结果链接出现…")
        for _ in range(40):
            await page.wait_for_timeout(1000)
            sniff_link(await page.content())
            if captured_links:
                break

        # 也从可见文本/输入框里找链接
        for sel in ["textarea", "input[type=text]", ".link", "[data-link]"]:
            try:
                n = await page.locator(sel).count()
                for i in range(min(n, 8)):
                    t = await page.locator(sel).nth(i).input_value() if sel.startswith(("textarea", "input")) else ""
                    sniff_link(t)
            except Exception:
                pass

        await browser.close()

        if captured_links:
            print("\nUPLOAD_LINKS:")
            for l in captured_links:
                print("  " + l)
            return 0
        print("\n未捕获到链接；网络记录：")
        for r in upload_responses[-10:]:
            print("  " + r)
        return 3

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: upload-netdisk.py <file>")
        sys.exit(1)
    sys.exit(asyncio.run(main(sys.argv[1])))

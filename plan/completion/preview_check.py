import os

from playwright.sync_api import sync_playwright


def check_preview(base_url: str, width: int) -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": width, "height": 800})
        errors: list[str] = []
        page.on("console", lambda message: errors.append(f"console: {message.text}") if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(f"page: {error.message}"))
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        if width >= 1024:
            page.get_by_role("heading", name="Prompt Library").wait_for()
        else:
            page.get_by_role("searchbox", name="Search prompts").wait_for()
        assert page.get_by_role("main").is_visible()
        assert not errors, errors
        browser.close()


if __name__ == "__main__":
    base_url = os.environ.get("PREVIEW_BASE_URL", "http://127.0.0.1:4174")
    check_preview(base_url, 1280)
    check_preview(base_url, 375)
    print("Production preview passed at 1280px and 375px with no console/page errors")

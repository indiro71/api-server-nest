import { Injectable } from '@nestjs/common';
import { Browser, launch, Page } from 'puppeteer';
import random from 'random';

interface browserOptions {
  headless: boolean;
  defaultViewport: {
    width: number;
    height: number;
  };
  args: string[];
}

@Injectable()
export class ParserService {
  private browser: Browser;
  private page: Page;
  private mobile: boolean;
  private tested: boolean;
  private readonly user_desktop_agent: string;
  private readonly user_mobile_agent: string;
  private readonly useProxy: boolean;

  constructor() {
    this.browser = null;
    this.page = null;
    this.mobile = true;
    this.tested = false;
    this.useProxy = false;
    this.user_mobile_agent =
      'Mozilla/5.0 (Linux; Android 8.0.0; SM-G960F Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.84 Mobile Safari/537.36';
    this.user_desktop_agent =
      'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36';
  }

  async initBrowser(mobile = true, tested = false) {
    this.mobile = mobile;
    this.tested = tested;

    const options: browserOptions = {
      headless: !this.tested,
      defaultViewport: {
        width: this.mobile ? 320 : 1920,
        height: this.mobile ? 570 : 1080,
      },
      args: ['--no-sandbox', '--lang=en-EN,en'],
    };

    if (this.useProxy) {
      options.args.push('--proxy-server=IP:PORT');
    }

    this.browser = await launch(options);
  }

  async newPage() {
    if (!this.browser) {
      await this.initBrowser(true, process.env.NODE_ENV === 'development');
    }

    if (!this.page) {
      this.page = await this.browser.newPage();
    }

    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en',
    });

    if (this.mobile) {
      await this.page.setUserAgent(this.user_mobile_agent);
    } else {
      await this.page.setUserAgent(this.user_desktop_agent);
    }
  }

  async createPage() {
    if (!this.browser) {
      await this.initBrowser(true, process.env.NODE_ENV === 'development');
    }

    const newPage: Page = await this.browser.newPage();

    await newPage.setExtraHTTPHeaders({
      'Accept-Language': 'en',
    });

    if (this.mobile) {
      await newPage.setUserAgent(this.user_mobile_agent);
    } else {
      await newPage.setUserAgent(this.user_desktop_agent);
    }

    return newPage;
  }

  async closePage() {
    await this.page.close();
  }

  async closeBrowser() {
    await this.browser.close();
  }

  async wait(min = 0, max = 0) {
    if (min === 0) return false;

    await this.page.waitFor(max > 0 ? random.int(min, max) : min);
  }

  async getPageContent(url: string, page: Page = this.page) {
    try {
      let closeAfterParse;
      if (!page || page.isClosed()) {
        closeAfterParse = true;
        page = await this.createPage();
      }
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const content = await page.content();
      if (closeAfterParse) {
        await page.close()
      }
      return content;
    } catch (e) {
      await this.closeBrowser();
    }
  }
}

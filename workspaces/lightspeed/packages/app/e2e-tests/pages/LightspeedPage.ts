/*
 * Copyright Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Page, expect } from '@playwright/test';
import { LightspeedMessages, evaluateMessage } from '../utils/translations';

export type DisplayMode = 'Overlay' | 'Dock to window' | 'Fullscreen';

export class LightspeedPage {
  constructor(
    readonly page: Page,
    readonly translations: LightspeedMessages,
  ) {}

  // Locators
  readonly chatbotToggleButton = () =>
    this.page.getByRole('button', { name: 'lightspeed-close' });
  readonly chatbotOptionsMenuButton = () =>
    this.page.getByRole('button', {
      name: this.translations['aria.settings.label'],
    });
  readonly chatHistoryMenuButton = () =>
    this.page.getByRole('button', {
      name: this.translations['aria.chatHistoryMenu'],
    });
  readonly drawerCloseButton = () =>
    this.page.getByRole('button', {
      name: this.translations['aria.closeDrawerPanel'],
    });
  readonly chatbotHeader = () => this.page.locator('.pf-chatbot__header');
  readonly conversationArea = () =>
    this.page.getByLabel('Scrollable message log');
  readonly chatbotPanel = () =>
    this.page.getByLabel('Chatbot', { exact: true });
  readonly chatInputTextbox = () =>
    this.page.getByRole('textbox', {
      name: this.translations['chatbox.message.placeholder'],
    });
  readonly accuracyButton = () =>
    this.page.getByRole('button', {
      name: this.translations['footer.accuracy.label'],
    });
  readonly backstagePageContent = () => this.page.getByText('Red Hat Catalog');

  // Actions
  async goto(path = '/') {
    await this.page.goto(path);
  }

  async openChatbot() {
    await this.chatbotToggleButton().click();
  }

  async selectDisplayMode(mode: DisplayMode) {
    await this.chatbotOptionsMenuButton().click();
    const menuItemName = this.getDisplayModeTranslation(mode);
    await this.page.getByRole('menuitem', { name: menuItemName }).click();
  }

  async openChatHistoryDrawer() {
    await this.chatHistoryMenuButton().click();
  }

  async closeChatHistoryDrawer() {
    await this.drawerCloseButton().click();
  }

  // Assertions
  async expectBackstagePageVisible(visible = true) {
    const assertion = visible
      ? expect(this.backstagePageContent())
      : expect(this.backstagePageContent()).not;
    await assertion.toBeVisible();
  }

  async expectChatbotControlsVisible() {
    await expect(this.chatbotHeader()).toBeVisible();
    await expect(this.chatHistoryMenuButton()).toBeVisible();
    await expect(this.chatbotOptionsMenuButton()).toBeVisible();
  }

  async verifyDisplayModeMenuOptions() {
    await this.chatbotOptionsMenuButton().click();
    const t = this.translations;
    await expect(this.chatbotPanel()).toMatchAriaSnapshot(`
      - menu:
        - menuitem "${t['settings.displayMode.label']}" [disabled]
        - menuitem "${t['settings.displayMode.overlay']}"
        - menuitem "${t['settings.displayMode.docked']}"
        - menuitem "${t['settings.displayMode.fullscreen']}"
      - separator
      - menu:
        - menuitem "${t['settings.pinned.disable']} ${t['settings.pinned.enabled.description']}"
      `);
  }

  async expectChatInputAreaVisible() {
    await expect(this.chatInputTextbox()).toBeVisible();
    await expect(this.accuracyButton()).toBeVisible();
  }

  async expectEmptyChatHistory() {
    const t = this.translations;
    await expect(
      this.page.getByRole('heading', {
        name: t['conversation.category.pinnedChats'],
      }),
    ).toBeVisible();
    await expect(
      this.page.getByRole('menuitem', {
        name: t['chatbox.emptyState.noPinnedChats'],
      }),
    ).toBeVisible();
    await expect(
      this.page.getByRole('heading', {
        name: t['conversation.category.recent'],
      }),
    ).toBeVisible();
    await expect(
      this.page.getByRole('menuitem', {
        name: t['chatbox.emptyState.noRecentChats'],
      }),
    ).toBeVisible();
  }

  private getDisplayModeTranslation(mode: DisplayMode): string {
    const modeMap: Record<DisplayMode, string> = {
      Overlay: this.translations['settings.displayMode.overlay'],
      'Dock to window': this.translations['settings.displayMode.docked'],
      Fullscreen: this.translations['settings.displayMode.fullscreen'],
    };
    return modeMap[mode];
  }

  private getWelcomeHeader(): string {
    const t = this.translations;
    const greeting = evaluateMessage(
      t['chatbox.welcome.greeting'],
      t['user.guest'],
    );
    return `
      - region "Scrollable message log":
        - 'heading "Info alert: ${t['aria.important']}" [level=4]'
        - text: ${t['disclaimer.withValidation']}
        - heading "${greeting} ${t['chatbox.welcome.description']}" [level=1]`;
  }

  private readonly buttonGroup = `
        - button
        - text: ''`;

  private readonly buttonCounts: Record<DisplayMode, number> = {
    Overlay: 1,
    'Dock to window': 2,
    Fullscreen: 3,
  };

  async expectConversationArea(mode: DisplayMode) {
    const buttons = this.buttonGroup.repeat(this.buttonCounts[mode]);
    const snapshot = `${this.getWelcomeHeader()}${buttons}
      `;
    await expect(this.conversationArea()).toMatchAriaSnapshot(snapshot);
  }
}

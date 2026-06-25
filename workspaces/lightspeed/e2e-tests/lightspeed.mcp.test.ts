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

import { test, expect, Page } from '@playwright/test';
import {
  conversations,
  E2E_MCP_VALID_TOKEN,
  mcpServerScenarios,
  tokenCredentialNoUrlScenario,
  tokenCredentialValidationScenario,
  type McpServersListMock,
  generateQueryResponseWithMcpToolCall,
  modelBaseUrl,
} from './fixtures/responses';
import { openLightspeed, sendMessage } from './utils/testHelper';
import {
  openChatbot,
  selectDisplayMode,
  expectBackstagePageVisible,
  verifyMcpSettingsPanel,
  openMcpSettingsPanel,
  closeMcpSettingsPanel,
  mcpServerToggle,
  mcpServerRow,
  clickMcpServersStatusColumn,
  clickMcpServersNameColumn,
  mcpServersTableBodyRows,
  mcpEditServerButton,
} from './pages/LightspeedPage';
import { McpConfigureTokenPage } from './pages/McpConfigureTokenPage';
import {
  mockChatHistory,
  mockConversations,
  mockMcpServers,
  mockQuery,
} from './utils/devMode';
import {
  LightspeedMessages,
  evaluateMessage,
  formatMcpToolCountStatus,
} from './utils/translations';
import {
  bootstrapLightspeedE2ePage,
  LIGHTSPEED_E2E_DEFAULT_BOT_QUERY,
} from './utils/lightspeedE2eSetup';
import {
  DCR_SERVER_NAME,
  STATIC_SERVER_NAME,
  dcrDisplayModes,
  dcrOnlyScenario,
  dcrStatusLabel,
  expectDcrModalReadOnly,
  mixedDcrAndStaticScenario,
  openDcrConfigureModal,
} from './utils/mcpDcrSupport';

test.describe('Intelligent assistant MCP', () => {
  let translations: LightspeedMessages;
  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    const boot = await bootstrapLightspeedE2ePage(browser);
    sharedPage = boot.page;
    translations = boot.translations;
  });

  test.describe('Chatbot MCP settings', () => {
    async function runMcpPanelScenario(mcpList: McpServersListMock) {
      await mockMcpServers(sharedPage, mcpList);
      await openChatbot(sharedPage, translations);
      await verifyMcpSettingsPanel(sharedPage, translations, mcpList);
    }

    test.beforeEach(async () => {
      await sharedPage.goto('/');
    });

    test.afterEach(async () => {
      await mockMcpServers(sharedPage);
    });

    test('Overlay', async () => {
      await expectBackstagePageVisible(sharedPage);
      await openChatbot(sharedPage, translations);
      await verifyMcpSettingsPanel(sharedPage, translations);
    });

    test('Dock to Window', async () => {
      await openChatbot(sharedPage, translations);
      await selectDisplayMode(sharedPage, translations, 'Dock to window');
      await verifyMcpSettingsPanel(sharedPage, translations);
    });

    test('Fullscreen', async () => {
      await openChatbot(sharedPage, translations);
      await selectDisplayMode(sharedPage, translations, 'Fullscreen');
      await verifyMcpSettingsPanel(sharedPage, translations);
    });

    test('Empty list', async () => {
      await runMcpPanelScenario(mcpServerScenarios.empty);
    });

    test.describe('Two-row mocks', () => {
      test('All healthy', async () => {
        await runMcpPanelScenario(mcpServerScenarios.allHealthy);
      });

      test('Failed + OK', async () => {
        await runMcpPanelScenario(mcpServerScenarios.errorAndOk);
      });

      test('Disabled + active', async () => {
        await runMcpPanelScenario(mcpServerScenarios.disabledAndOk);
      });

      test('Both need token', async () => {
        await runMcpPanelScenario(mcpServerScenarios.twoTokenRequired);
      });
    });

    test('Sort works as expected', async () => {
      await mockMcpServers(sharedPage, mcpServerScenarios.allHealthy);
      await openChatbot(sharedPage, translations);
      await openMcpSettingsPanel(sharedPage, translations);

      const rows = mcpServersTableBodyRows(sharedPage, translations);
      await expect(rows.nth(0)).toContainText('alpha-mcp');
      await expect(rows.nth(1)).toContainText('beta-mcp');

      await clickMcpServersNameColumn(sharedPage, translations);
      await expect(rows.nth(0)).toContainText('beta-mcp');
      await expect(rows.nth(1)).toContainText('alpha-mcp');

      await closeMcpSettingsPanel(sharedPage, translations);
    });

    test('Toggle works as expected', async () => {
      const serverName = 'mcp-integration-tools';
      await openChatbot(sharedPage, translations);
      await openMcpSettingsPanel(sharedPage, translations);

      const row = mcpServerRow(sharedPage, serverName, translations);
      await clickMcpServersStatusColumn(sharedPage, translations);
      await mcpServerToggle(sharedPage, serverName, translations).click();
      await expect(
        row.getByText(translations['mcp.settings.status.disabled'], {
          exact: true,
        }),
      ).toBeVisible();

      await mcpServerToggle(sharedPage, serverName, translations).click();
      await expect(
        row.getByText(formatMcpToolCountStatus(translations, 14), {
          exact: true,
        }),
      ).toBeVisible();

      await closeMcpSettingsPanel(sharedPage, translations);
    });

    test.describe('Configure MCP server token', () => {
      let mcpToken: McpConfigureTokenPage;

      test.beforeEach(() => {
        mcpToken = new McpConfigureTokenPage(sharedPage, translations);
      });

      test('Valid token saves and row shows tools — Overlay', async () => {
        await mcpToken.gotoMcpSettings(
          tokenCredentialValidationScenario,
          'Overlay',
        );

        const serverName = 'credential-test-mcp';
        await mcpToken.seeRowStatus(
          serverName,
          translations['mcp.settings.status.tokenRequired'],
        );

        await mcpToken.openEditServer(serverName);
        await mcpToken.typeToken(E2E_MCP_VALID_TOKEN);
        await mcpToken.save();

        await mcpToken.seeTokenHidden();
        await mcpToken.seeRowStatus(
          serverName,
          formatMcpToolCountStatus(translations, 5),
        );

        await mcpToken.closeMcpPanel();
      });

      test('Invalid token then valid token — Dock to window', async () => {
        await mcpToken.gotoMcpSettings(
          tokenCredentialValidationScenario,
          'Dock to window',
        );

        const serverName = 'credential-test-mcp';
        await mcpToken.openEditServer(serverName);

        await mcpToken.typeToken('bad-token');
        await mcpToken.save();
        await mcpToken.seeMessage(
          translations['mcp.settings.token.invalidCredentials'],
        );

        await mcpToken.typeToken(E2E_MCP_VALID_TOKEN);
        await mcpToken.save();
        await mcpToken.seeTokenHidden();
        await mcpToken.seeRowStatus(
          serverName,
          formatMcpToolCountStatus(translations, 5),
        );

        await mcpToken.closeMcpPanel();
      });

      test('Cancel discards without saving — Fullscreen', async () => {
        await mcpToken.gotoMcpSettings(
          tokenCredentialValidationScenario,
          'Fullscreen',
        );

        const serverName = 'credential-test-mcp';
        await mcpToken.openEditServer(serverName);
        await mcpToken.typeToken('draft-token');
        await mcpToken.cancel();

        await mcpToken.seeModalClosed();
        await mcpToken.seeRowStatus(
          serverName,
          translations['mcp.settings.status.tokenRequired'],
        );

        await mcpToken.closeMcpPanel();
      });

      test('Server validation failure shows error — Overlay', async () => {
        await mcpToken.gotoMcpSettings(
          tokenCredentialValidationScenario,
          'Overlay',
          {
            failServerValidateFor: 'credential-test-mcp',
            failServerValidateError:
              translations['mcp.settings.token.validationFailed'],
          },
        );

        const serverName = 'credential-test-mcp';
        await mcpToken.openEditServer(serverName);
        await mcpToken.typeToken(E2E_MCP_VALID_TOKEN);
        await mcpToken.save();

        await mcpToken.seeMessage(
          translations['mcp.settings.token.validationFailed'],
        );
        await mcpToken.cancel();
        await mcpToken.closeMcpPanel();
      });

      test('Missing server URL shows error — Dock to window', async () => {
        await mcpToken.gotoMcpSettings(
          tokenCredentialNoUrlScenario,
          'Dock to window',
        );

        const serverName = 'no-url-mcp';
        await mcpToken.openEditServer(serverName);
        await mcpToken.typeToken(E2E_MCP_VALID_TOKEN);
        await mcpToken.save();

        await mcpToken.seeMessage(
          translations['mcp.settings.token.urlUnavailableForValidation'],
        );
        await mcpToken.cancel();
        await mcpToken.closeMcpPanel();
      });

      test('Clear token input empties PAT — Fullscreen', async () => {
        await mcpToken.gotoMcpSettings(
          tokenCredentialNoUrlScenario,
          'Fullscreen',
        );

        await mcpToken.openEditServer('no-url-mcp');
        await mcpToken.typeThenClearToken('e2e-draft-personal-access-token');

        await mcpToken.cancel();
        await mcpToken.closeMcpPanel();
      });
    });

    test.describe('DCR MCP servers', () => {
      test('shows Backstage-managed auth status in row', async () => {
        await mockMcpServers(sharedPage, dcrOnlyScenario);
        await openChatbot(sharedPage, translations);
        await openMcpSettingsPanel(sharedPage, translations);

        const dcrRow = mcpServerRow(sharedPage, DCR_SERVER_NAME, translations);
        await expect(
          dcrRow.getByText(
            dcrStatusLabel(
              translations,
              dcrOnlyScenario.servers[0]?.toolCount ?? 0,
            ),
            { exact: true },
          ),
        ).toBeVisible();
        await expect(
          dcrRow.getByText(translations['mcp.settings.status.tokenRequired'], {
            exact: true,
          }),
        ).not.toBeVisible();

        await closeMcpSettingsPanel(sharedPage, translations);
      });

      test('configure modal is read-only across all display modes', async () => {
        for (const mode of dcrDisplayModes) {
          await sharedPage.goto('/');
          await openDcrConfigureModal(sharedPage, translations, mode);
          await expectDcrModalReadOnly(sharedPage, translations);

          await sharedPage
            .getByRole('dialog')
            .getByRole('button', { name: translations['common.cancel'] })
            .click();
          await closeMcpSettingsPanel(sharedPage, translations);
        }
      });

      test('mixed servers show managed and token-edit configure behavior', async () => {
        await mockMcpServers(sharedPage, mixedDcrAndStaticScenario);
        await openChatbot(sharedPage, translations);
        await openMcpSettingsPanel(sharedPage, translations);

        const dcrRow = mcpServerRow(sharedPage, DCR_SERVER_NAME, translations);
        await expect(
          dcrRow.getByText(
            dcrStatusLabel(
              translations,
              mixedDcrAndStaticScenario.servers[0]?.toolCount ?? 0,
            ),
            { exact: true },
          ),
        ).toBeVisible();

        const staticRow = mcpServerRow(
          sharedPage,
          STATIC_SERVER_NAME,
          translations,
        );
        await expect(
          staticRow.getByText(
            translations['mcp.settings.status.tokenRequired'],
            {
              exact: true,
            },
          ),
        ).toBeVisible();

        await mcpEditServerButton(
          sharedPage,
          DCR_SERVER_NAME,
          translations,
        ).click();
        await expectDcrModalReadOnly(sharedPage, translations);
        await sharedPage
          .getByRole('dialog')
          .getByRole('button', { name: translations['common.cancel'] })
          .click();

        await mcpEditServerButton(
          sharedPage,
          STATIC_SERVER_NAME,
          translations,
        ).click();
        const staticModal = sharedPage.getByRole('dialog');
        await expect(staticModal.locator('#mcp-pat-input')).toBeVisible();
        await expect(
          staticModal.getByRole('button', { name: translations['modal.save'] }),
        ).toBeVisible();
        await staticModal
          .getByRole('button', { name: translations['common.cancel'] })
          .click();

        await closeMcpSettingsPanel(sharedPage, translations);
      });

      test('toggle off/on preserves disabled and managed status', async () => {
        await mockMcpServers(sharedPage, dcrOnlyScenario);
        await openChatbot(sharedPage, translations);
        await openMcpSettingsPanel(sharedPage, translations);

        const dcrRow = mcpServerRow(sharedPage, DCR_SERVER_NAME, translations);
        await clickMcpServersStatusColumn(sharedPage, translations);
        await mcpServerToggle(
          sharedPage,
          DCR_SERVER_NAME,
          translations,
        ).click();
        await expect(
          dcrRow.getByText(translations['mcp.settings.status.disabled'], {
            exact: true,
          }),
        ).toBeVisible();

        await mcpServerToggle(
          sharedPage,
          DCR_SERVER_NAME,
          translations,
        ).click();
        await expect(
          dcrRow.getByText(
            dcrStatusLabel(
              translations,
              dcrOnlyScenario.servers[0]?.toolCount ?? 0,
            ),
            { exact: true },
          ),
        ).toBeVisible();

        await closeMcpSettingsPanel(sharedPage, translations);
      });

      test('validate failure surfaces failed status', async () => {
        await mockMcpServers(sharedPage, dcrOnlyScenario, {
          failServerValidateFor: DCR_SERVER_NAME,
          failServerValidateError:
            translations['mcp.settings.token.validationFailed'],
        });
        await openChatbot(sharedPage, translations);
        await openMcpSettingsPanel(sharedPage, translations);

        const dcrRow = mcpServerRow(sharedPage, DCR_SERVER_NAME, translations);
        await expect(
          dcrRow.getByText(translations['mcp.settings.status.failed'], {
            exact: true,
          }),
        ).toBeVisible();

        await mcpEditServerButton(
          sharedPage,
          DCR_SERVER_NAME,
          translations,
        ).click();
        await expectDcrModalReadOnly(sharedPage, translations);
        await sharedPage
          .getByRole('dialog')
          .getByRole('button', { name: translations['common.cancel'] })
          .click();

        await closeMcpSettingsPanel(sharedPage, translations);
      });
    });
  });

  test('MCP tool calling renders in UI', async () => {
    const mcpToolCallPrompt = 'test mcp tool call';

    await mockConversations(sharedPage, conversations, true);
    await mockChatHistory(sharedPage, []);
    await openLightspeed(sharedPage);

    await sharedPage.unroute(`${modelBaseUrl}/v1/query`);
    await sharedPage.route(`${modelBaseUrl}/v1/query`, async route => {
      const payload = route.request().postDataJSON();
      if (payload.conversation_id) {
        conversations[1].conversation_id = payload.conversation_id;
      }
      const conversationId =
        conversations[1].conversation_id ?? conversations[0].conversation_id;
      await route.fulfill({
        body: generateQueryResponseWithMcpToolCall(conversationId),
      });
    });

    await sendMessage(mcpToolCallPrompt, sharedPage, translations);

    await expect(
      sharedPage.getByRole('button', {
        name: evaluateMessage(
          translations['toolCall.header'],
          'mcp_list_tools',
        ),
      }),
    ).toBeVisible();

    await sharedPage.unroute(`${modelBaseUrl}/v1/query`);
    await mockQuery(
      sharedPage,
      LIGHTSPEED_E2E_DEFAULT_BOT_QUERY,
      conversations,
    );
  });
});

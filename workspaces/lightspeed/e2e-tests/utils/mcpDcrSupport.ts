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

import { expect, type Page } from '@playwright/test';
import { type McpServersListMock } from '../fixtures/responses';
import {
  mcpEditServerButton,
  openChatbot,
  openMcpSettingsPanel,
  selectDisplayMode,
  type DisplayMode,
} from '../pages/LightspeedPage';
import { mockMcpServers } from './devMode';
import {
  formatMcpToolCountStatus,
  type LightspeedMessages,
} from './translations';

type McpServerMockWithAuth = McpServersListMock['servers'][number] & {
  auth?: 'dcr';
};

type McpServersListMockWithAuth = {
  servers: McpServerMockWithAuth[];
};

const withAuth = (mock: McpServersListMockWithAuth): McpServersListMock =>
  mock as unknown as McpServersListMock;

export const DCR_SERVER_NAME = 'mcp-integration-tools';
export const STATIC_SERVER_NAME = 'test-mcp-server';

export const dcrOnlyScenario = withAuth({
  servers: [
    {
      name: DCR_SERVER_NAME,
      url: 'http://localhost:7007/api/mcp-actions/v1',
      status: 'connected',
      toolCount: 5,
      enabled: true,
      hasToken: true,
      hasUserToken: false,
      auth: 'dcr',
    },
  ],
});

export const mixedDcrAndStaticScenario = withAuth({
  servers: [
    {
      name: DCR_SERVER_NAME,
      url: 'http://localhost:7007/api/mcp-actions/v1',
      status: 'connected',
      toolCount: 5,
      enabled: true,
      hasToken: true,
      hasUserToken: false,
      auth: 'dcr',
    },
    {
      name: STATIC_SERVER_NAME,
      url: 'http://localhost:8888/mcp',
      status: 'unknown',
      toolCount: 0,
      enabled: true,
      hasToken: false,
      hasUserToken: false,
    },
  ],
});

export const dcrDisplayModes: DisplayMode[] = [
  'Overlay',
  'Dock to window',
  'Fullscreen',
];

export function dcrStatusLabel(
  t: LightspeedMessages,
  toolCount: number,
): string {
  const autoManaged = (t as Record<string, string>)[
    'mcp.settings.status.autoManaged'
  ];
  return autoManaged ?? formatMcpToolCountStatus(t, toolCount);
}

export async function openDcrConfigureModal(
  page: Page,
  t: LightspeedMessages,
  mode: DisplayMode,
): Promise<void> {
  await mockMcpServers(page, dcrOnlyScenario);
  await openChatbot(page, t);
  if (mode !== 'Overlay') {
    await selectDisplayMode(page, t, mode);
  }
  await openMcpSettingsPanel(page, t);
  await mcpEditServerButton(page, DCR_SERVER_NAME, t).click();
}

export async function expectDcrModalReadOnly(
  page: Page,
  t: LightspeedMessages,
): Promise<void> {
  const modal = page.getByRole('dialog');
  await expect(
    modal.getByText(t['mcp.settings.modalDescriptionDcr'], {
      exact: true,
    }),
  ).toBeVisible();
  await expect(modal.locator('#mcp-pat-input')).toHaveCount(0);
  await expect(
    modal.getByRole('button', { name: t['modal.save'] }),
  ).toHaveCount(0);
}

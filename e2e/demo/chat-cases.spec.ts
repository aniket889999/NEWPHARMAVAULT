import { test, expect, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { signIn } from '../tests/helpers';

// Mentor's four chatbot scenarios, asked in ONE conversation on the running app (synthetic account).
// Saves a screenshot per case plus the raw text the app showed, so the slide reports what really happened.
const OUT = path.resolve(__dirname, '..', 'demo-out', 'chat');
const CLAIMANT = { tab: 'patient' as const, email: 'ananya.verma@claimant.example' };
const CASES = [
  { id: 'case1-direct-rag', q: 'What is Metformin used for, and what are its common side effects? Cite the supporting sources.' },
  { id: 'case2-followup-b12', q: 'Can it affect vitamin B12 levels? Explain briefly and cite the evidence.' },
  { id: 'case3-topic-switch', q: 'Now switch to Cetirizine. Can it make me sleepy? Give a brief answer with a source.' },
  { id: 'case4-ambiguity', q: 'I am asking about Metformin and Cetirizine. What are its side effects?' }
];

async function waitForAnswer(page: Page, count: number) {
  const answers = page.getByLabel('Conversation').locator('div.group.flex.gap-3');
  await expect(answers).toHaveCount(count, { timeout: 90_000 });
  await expect(page.getByLabel('Stop response')).toHaveCount(0, { timeout: 90_000 });
  await page.waitForTimeout(800);
  return answers.last();
}

test('Mentor chatbot cases: RAG, follow-up, topic switch, ambiguity', async ({ browser }) => {
  fs.mkdirSync(OUT, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 2400 } });
  const page = await context.newPage();
  const raw: string[] = [];
  page.on('response', async res => {
    if (!res.url().includes('/v1/chat/stream')) return;
    try { raw.push(await res.text()); } catch { raw.push('[stream body unavailable]'); }
  });
  await signIn(page, CLAIMANT);
  await page.waitForURL('**/patient/**');
  await page.goto('/patient/health-assistant');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(OUT, '00-assistant-start.png'), clip: { x: 0, y: 0, width: 1440, height: 900 } });

  const report: Array<Record<string, unknown>> = [];
  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    const input = page.getByLabel('Message Health Assistant');
    await input.fill(c.q);
    await page.getByLabel('Send message').click();
    const answer = await waitForAnswer(page, i + 1);
    const sources = answer.getByRole('button', { name: /Sources ·/ });
    if (await sources.count()) await sources.first().click();
    const route = answer.locator('details summary');
    if (await route.count()) await route.first().click();
    await page.waitForTimeout(500);
    const question = page.getByLabel('Conversation').locator('div.flex.justify-end').last();
    await question.scrollIntoViewIfNeeded();
    const qb = await question.boundingBox();
    const ab = await answer.boundingBox();
    if (qb && ab) {
      const y = Math.max(0, qb.y - 16);
      await page.screenshot({ path: path.join(OUT, `${String(i + 1).padStart(2, '0')}-${c.id}.png`), clip: { x: Math.max(0, ab.x - 24), y, width: Math.min(1440 - ab.x + 24, 1100), height: Math.min(ab.y + ab.height - y + 16, 2380) } });
    }
    await answer.screenshot({ path: path.join(OUT, `${String(i + 1).padStart(2, '0')}-${c.id}-answer.png`) });
    report.push({ case: c.id, question: c.q, shownText: (await answer.innerText()).trim() });
  }
  fs.writeFileSync(path.join(OUT, 'cases.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT, 'stream-raw.txt'), raw.join('\n\n=====\n\n'));
  await context.close();
});

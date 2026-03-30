import { Page } from 'playwright';
import { answerQuestion } from '../scorer/question-answerer';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getFieldLabel(page: Page, element: any): Promise<string> {
  try {
    const ariaLabel = await element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    const id = await element.getAttribute('id');
    if (id) {
      const label = await page
        .$eval(`label[for="${id}"]`, (el: Element) => el.textContent?.trim() ?? '')
        .catch(() => '');
      if (label) return label;
    }

    const parentLabel = await element
      .evaluate((el: Element) => {
        const label = el.closest('label');
        return label?.textContent?.trim() ?? '';
      })
      .catch(() => '');

    return parentLabel;
  } catch {
    return '';
  }
}

export async function fillTextInputs(page: Page): Promise<void> {
  const inputs = await page.$$(
    '.jobs-easy-apply-form-element input[type="text"]:not([readonly]), ' +
      '.jobs-easy-apply-form-element input[type="tel"], ' +
      '.jobs-easy-apply-form-element input[type="email"], ' +
      '.jobs-easy-apply-form-element input[type="number"]',
  );

  for (const input of inputs) {
    const label = await getFieldLabel(page, input);
    if (!label) continue;

    const existing = await input.inputValue().catch(() => '');
    if (existing) {
      console.log(`    Pre-filled: "${label}" = "${existing}"`);
      continue;
    }

    const answer = await answerQuestion(label, 'text');
    if (answer) {
      await input.fill(answer);
      await sleep(300);
      console.log(`    Filled: "${label}" = "${answer}"`);
    }
  }
}

export async function fillTextareas(page: Page): Promise<void> {
  const textareas = await page.$$('.jobs-easy-apply-form-element textarea');

  for (const textarea of textareas) {
    const label = await getFieldLabel(page, textarea);
    if (!label) continue;

    const existing = await textarea.inputValue().catch(() => '');
    if (existing) continue;

    const answer = await answerQuestion(label, 'textarea');
    if (answer) {
      await textarea.fill(answer);
      await sleep(300);
      console.log(`    Filled textarea: "${label}"`);
    }
  }
}

export async function fillSelects(page: Page): Promise<void> {
  const selects = await page.$$('.jobs-easy-apply-form-element select');

  for (const select of selects) {
    const label = await getFieldLabel(page, select);
    if (!label) continue;

    const options = await select.$$eval('option:not([value=""])', (opts: Element[]) =>
      opts.map((o) => (o as HTMLOptionElement).text),
    );

    if (!options.length) continue;

    const answer = await answerQuestion(label, 'select', options);
    const bestOption =
      options.find(
        (o) =>
          o.toLowerCase().includes(answer.toLowerCase()) ||
          answer.toLowerCase().includes(o.toLowerCase()),
      ) ?? options[0];

    await select.selectOption({ label: bestOption });
    console.log(`    Select: "${label}" → "${bestOption}"`);
    await sleep(300);
  }
}

export async function fillRadios(page: Page): Promise<void> {
  const groups = await page.$$('.jobs-easy-apply-form-element fieldset');

  for (const group of groups) {
    const legend = await group
      .$eval('legend', (el: Element) => el.textContent?.trim() ?? '')
      .catch(() => '');

    if (!legend) continue;

    const radioLabels = await group.$$eval('label', (labels: Element[]) =>
      labels.map((l) => l.textContent?.trim() ?? ''),
    );

    const answer = await answerQuestion(legend, 'radio', radioLabels);

    const radios = await group.$$('input[type="radio"]');
    for (const radio of radios) {
      const radioId = await radio.getAttribute('id');
      if (!radioId) continue;

      const radioLabel = await page
        .$eval(`label[for="${radioId}"]`, (el: Element) => el.textContent?.trim() ?? '')
        .catch(() => '');

      if (radioLabel.toLowerCase().includes(answer.toLowerCase())) {
        await radio.click();
        console.log(`    Radio: "${legend}" → "${radioLabel}"`);
        break;
      }
    }
    await sleep(300);
  }
}

export async function handleFormFields(page: Page): Promise<void> {
  await fillTextInputs(page);
  await fillTextareas(page);
  await fillSelects(page);
  await fillRadios(page);
}

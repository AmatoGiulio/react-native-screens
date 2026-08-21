import { expect as jestExpect } from '@jest/globals';
import { by, device, element, expect, waitFor } from 'detox';
import type { AndroidElementAttributes } from 'detox/detox';
import type { ProbeSnapshot } from '@apps/tests/single-feature-tests/stack-v5/test-stack-nested-scroll-interop-android';
import {
  describeIfAndroid,
  getElementAttributes,
  getMatches,
  selectSingleFeatureTestsScreen,
  waitUntil,
} from '../../e2e-utils';
import {
  CLASS_NAME_ANDROID_APP_BAR_LAYOUT,
  CLASS_NAME_ANDROID_MATERIAL_TOOLBAR,
} from '../../native-class-names';

type ProbeScreen = 'home' | 'details' | 'nested';
type ProbeSnapshotForE2E = Pick<
  ProbeSnapshot,
  | 'sequence'
  | 'touchStarts'
  | 'nonTouchStarts'
  | 'touchPre'
  | 'nonTouchPre'
  | 'touchPost'
  | 'nonTouchPost'
  | 'delegateConsumedPreY'
  | 'delegateConsumedPostY'
  | 'lastScreenClass'
  | 'lastScreenId'
  | 'lastTargetClass'
  | 'lastTargetId'
  | 'lastTargetScrollY'
>;

const toolbar = by.type(CLASS_NAME_ANDROID_MATERIAL_TOOLBAR);
const appBar = by
  .type(CLASS_NAME_ANDROID_APP_BAR_LAYOUT)
  .withDescendant(toolbar);
const outerNestedAppBar = by
  .type(CLASS_NAME_ANDROID_APP_BAR_LAYOUT)
  .withDescendant(by.text('Outer nested header'));

let lastSnapshotSequence = 0;

function probeId(screen: ProbeScreen, suffix: string) {
  return `nested-scroll-probe-${screen}-${suffix}`;
}

async function readText(testID: string): Promise<string | null> {
  const attributes = (await getElementAttributes({
    by: 'id',
    value: testID,
  })) as AndroidElementAttributes;
  return attributes.text ?? null;
}

function parseNumber(value: string): number {
  return Number(value);
}

async function appBarAttributes(): Promise<AndroidElementAttributes> {
  const matches = await getMatches(appBar);
  jestExpect(matches).toHaveLength(1);
  return matches[0] as AndroidElementAttributes;
}

async function outerNestedAppBarAttributes(): Promise<AndroidElementAttributes> {
  const matches = await getMatches(outerNestedAppBar);
  jestExpect(matches).toHaveLength(1);
  return matches[0] as AndroidElementAttributes;
}

async function readSnapshot(
  screen: ProbeScreen,
): Promise<ProbeSnapshotForE2E> {
  await element(by.id(probeId(screen, 'snapshot-button'))).tap();

  let snapshot: ProbeSnapshotForE2E | null = null;
  await waitUntil(
    async () => {
      const status = await readText(probeId(screen, 'snapshot-status'));
      if (status === 'rejected') {
        throw new Error(`probe snapshot rejected on ${screen}`);
      }
      if (status !== 'resolved') {
        return false;
      }

      const identityText = await readText(probeId(screen, 'snapshot-identity'));
      const eventText = await readText(probeId(screen, 'snapshot-events'));
      const consumptionText = await readText(
        probeId(screen, 'snapshot-consumption'),
      );
      if (
        identityText == null ||
        identityText === 'none' ||
        eventText == null ||
        eventText === 'none' ||
        consumptionText == null ||
        consumptionText === 'none'
      ) {
        return false;
      }

      const identity = identityText.split('|');
      const events = eventText.split('|');
      const consumption = consumptionText.split('|');
      if (identity.length !== 6 || events.length !== 6 || consumption.length !== 2) {
        return false;
      }

      const sequence = parseNumber(identity[0]);
      if (!Number.isFinite(sequence) || sequence <= lastSnapshotSequence) {
        return false;
      }

      snapshot = {
        sequence,
        lastScreenClass: identity[1],
        lastScreenId: parseNumber(identity[2]),
        lastTargetClass: identity[3],
        lastTargetId: parseNumber(identity[4]),
        lastTargetScrollY: parseNumber(identity[5]),
        touchStarts: parseNumber(events[0]),
        nonTouchStarts: parseNumber(events[1]),
        touchPre: parseNumber(events[2]),
        nonTouchPre: parseNumber(events[3]),
        touchPost: parseNumber(events[4]),
        nonTouchPost: parseNumber(events[5]),
        delegateConsumedPreY: parseNumber(consumption[0]),
        delegateConsumedPostY: parseNumber(consumption[1]),
      };
      return Object.values(snapshot).every(value =>
        typeof value === 'number' ? Number.isFinite(value) : true,
      );
    },
    {
      timeout: 5000,
      message: () =>
        `expected a resolved probe snapshot newer than sequence ${lastSnapshotSequence} on ${screen}`,
    },
  );

  jestExpect(snapshot).not.toBeNull();
  lastSnapshotSequence = snapshot!.sequence;
  return snapshot!;
}

async function setMode(
  screen: ProbeScreen,
  mode: 'consume' | 'disabled',
) {
  const buttonSuffix = mode === 'disabled' ? 'disable' : mode;
  await element(by.id(probeId(screen, buttonSuffix))).tap();
  await waitFor(element(by.id(probeId(screen, 'mode'))))
    .toHaveText(mode)
    .withTimeout(3000);
}

async function waitForScreen(
  screen: ProbeScreen,
  label: 'Home' | 'Details' | 'Nested',
) {
  const route = element(by.id(probeId(screen, 'route')));
  await waitFor(route).toHaveText(label).withTimeout(5000);
  await waitFor(route).toBeVisible().withTimeout(5000);
  await waitFor(element(by.id(probeId(screen, 'scrollview'))))
    .toBeVisible()
    .withTimeout(5000);
}

async function scrollToTop(screen: ProbeScreen) {
  await element(by.id(probeId(screen, 'scrollview'))).scrollTo('top');
  await waitFor(element(by.id(probeId(screen, 'top'))))
    .toBeVisible()
    .withTimeout(3000);
}

describeIfAndroid('Stack v5: nested-scroll interop seam (Android)', () => {
  beforeEach(async () => {
    lastSnapshotSequence = 0;
    await device.reloadReactNative();
    await selectSingleFeatureTestsScreen(
      'Stackv5',
      'test-stack-nested-scroll-interop-android',
    );
    await waitForScreen('home', 'Home');
    await waitFor(element(toolbar)).toBeVisible().withTimeout(5000);
  });

  it('forwards the real Stack v5 touch and momentum transaction without consuming it', async () => {
    await scrollToTop('home');

    await element(by.id(probeId('home', 'scrollview'))).swipe(
      'up',
      'fast',
      0.9,
    );

    const snapshot = await readSnapshot('home');
    jestExpect(snapshot.lastScreenClass).toBe(
      'com.swmansion.rnscreens.stack.screen.StackScreen',
    );
    jestExpect(snapshot.lastTargetClass).toContain('ReactNestedScrollView');
    jestExpect(snapshot.touchStarts).toBeGreaterThan(0);
    jestExpect(snapshot.nonTouchStarts).toBeGreaterThan(0);
    jestExpect(snapshot.touchPre + snapshot.touchPost).toBeGreaterThan(0);
    jestExpect(snapshot.nonTouchPre + snapshot.nonTouchPost).toBeGreaterThan(0);
    jestExpect(snapshot.delegateConsumedPreY).toBe(0);
    jestExpect(snapshot.delegateConsumedPostY).toBe(0);
    jestExpect(snapshot.lastTargetScrollY).toBeGreaterThan(0);
  });

  it('keeps Stack v5 first and lets the delegate consume only the remaining distance', async () => {
    await scrollToTop('home');
    const expandedFrame = (await appBarAttributes()).frame;

    await setMode('home', 'consume');
    await element(by.id(probeId('home', 'scrollview'))).swipe(
      'up',
      'slow',
      0.9,
    );

    const snapshot = await readSnapshot('home');
    const collapsedFrame = (await appBarAttributes()).frame;

    jestExpect(
      Math.abs(snapshot.delegateConsumedPreY) +
        Math.abs(snapshot.delegateConsumedPostY),
    ).toBeGreaterThan(0);
    jestExpect(snapshot.lastTargetScrollY).toBe(0);
    jestExpect(collapsedFrame.y).toBeLessThan(expandedFrame.y);
  });

  it('switches to the pushed screen source and restores the original source on Back', async () => {
    await scrollToTop('home');
    await element(by.id(probeId('home', 'scrollview'))).swipe(
      'up',
      'slow',
      0.6,
    );
    const home = await readSnapshot('home');

    await element(by.id(probeId('home', 'push'))).tap();
    await waitForScreen('details', 'Details');
    await element(by.id(probeId('details', 'scrollview'))).swipe(
      'up',
      'slow',
      0.6,
    );
    const details = await readSnapshot('details');

    jestExpect(details.lastScreenId).not.toBe(home.lastScreenId);
    jestExpect(details.lastTargetId).not.toBe(home.lastTargetId);

    await device.pressBack();
    await waitForScreen('home', 'Home');
    await element(by.id(probeId('home', 'scrollview'))).swipe(
      'down',
      'slow',
      0.4,
    );
    const restoredHome = await readSnapshot('home');

    jestExpect(restoredHome.lastScreenId).toBe(home.lastScreenId);
    jestExpect(restoredHome.lastTargetId).toBe(home.lastTargetId);
  });

  it('preserves an outer Stack v5 header when the delegate accepts an inner stack source', async () => {
    await scrollToTop('home');
    await element(by.id(probeId('home', 'push-nested'))).tap();
    await waitForScreen('nested', 'Nested');
    await waitFor(element(by.text('Outer nested header')))
      .toBeVisible()
      .withTimeout(5000);

    await scrollToTop('nested');
    const expandedFrame = (await outerNestedAppBarAttributes()).frame;

    await element(by.id(probeId('nested', 'scrollview'))).swipe(
      'up',
      'slow',
      0.9,
    );

    const snapshot = await readSnapshot('nested');
    const collapsedFrame = (await outerNestedAppBarAttributes()).frame;

    jestExpect(snapshot.lastScreenClass).toBe(
      'com.swmansion.rnscreens.stack.screen.StackScreen',
    );
    jestExpect(snapshot.lastTargetClass).toContain('ReactNestedScrollView');
    jestExpect(snapshot.touchStarts).toBeGreaterThan(0);
    jestExpect(snapshot.delegateConsumedPreY).toBe(0);
    jestExpect(snapshot.delegateConsumedPostY).toBe(0);
    jestExpect(snapshot.lastTargetScrollY).toBeGreaterThan(0);
    jestExpect(collapsedFrame.y).toBeLessThan(expandedFrame.y);
  });

  it('is behaviorally inert when the external delegate declines nested scroll', async () => {
    await scrollToTop('home');
    await setMode('home', 'disabled');

    await element(by.id(probeId('home', 'scrollview'))).swipe(
      'up',
      'slow',
      0.9,
    );
    await element(by.id(probeId('home', 'scrollview'))).swipe(
      'up',
      'slow',
      0.9,
    );

    const snapshot = await readSnapshot('home');
    jestExpect(snapshot.touchStarts).toBe(0);
    jestExpect(snapshot.nonTouchStarts).toBe(0);
    jestExpect(snapshot.touchPre).toBe(0);
    jestExpect(snapshot.nonTouchPre).toBe(0);
    jestExpect(snapshot.touchPost).toBe(0);
    jestExpect(snapshot.nonTouchPost).toBe(0);
    jestExpect(snapshot.delegateConsumedPreY).toBe(0);
    jestExpect(snapshot.delegateConsumedPostY).toBe(0);
    await expect(element(by.id(probeId('home', 'top')))).not.toBeVisible();
  });
});

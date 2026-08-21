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

const SCROLL_VIEW = 'nested-scroll-probe-scrollview';
const TOP_MARKER = 'nested-scroll-probe-top';
const ROUTE = 'nested-scroll-probe-route';
const MODE = 'nested-scroll-probe-mode';
const SNAPSHOT = 'nested-scroll-probe-snapshot';
const SNAPSHOT_BUTTON = 'nested-scroll-probe-snapshot-button';

const toolbar = by.type(CLASS_NAME_ANDROID_MATERIAL_TOOLBAR);
const appBar = by
  .type(CLASS_NAME_ANDROID_APP_BAR_LAYOUT)
  .withDescendant(toolbar);

let lastSnapshotSequence = 0;

async function appBarAttributes(): Promise<AndroidElementAttributes> {
  const matches = await getMatches(appBar);
  jestExpect(matches).toHaveLength(1);
  return matches[0] as AndroidElementAttributes;
}

async function readSnapshot(): Promise<ProbeSnapshot> {
  await element(by.id(SNAPSHOT_BUTTON)).tap();

  let snapshot: ProbeSnapshot | null = null;
  await waitUntil(
    async () => {
      const attributes = (await getElementAttributes({
        by: 'id',
        value: SNAPSHOT,
      })) as AndroidElementAttributes;
      const text = attributes.text;
      if (text == null || text === 'none') {
        return false;
      }

      const parsed = JSON.parse(text) as ProbeSnapshot;
      if (parsed.sequence <= lastSnapshotSequence) {
        return false;
      }

      snapshot = parsed;
      return true;
    },
    {
      timeout: 3000,
      message: () =>
        `expected a probe snapshot newer than sequence ${lastSnapshotSequence}`,
    },
  );

  jestExpect(snapshot).not.toBeNull();
  lastSnapshotSequence = snapshot!.sequence;
  return snapshot!;
}

async function setMode(mode: 'observe' | 'consume' | 'disabled') {
  const buttonId =
    mode === 'disabled'
      ? 'nested-scroll-probe-disable'
      : `nested-scroll-probe-${mode}`;

  await element(by.id(buttonId)).tap();
  await waitFor(element(by.id(MODE))).toHaveText(mode).withTimeout(3000);
}

async function waitForRoute(route: 'Home' | 'Details') {
  await waitFor(element(by.id(ROUTE))).toHaveText(route).withTimeout(5000);
}

async function scrollToTop() {
  await element(by.id(SCROLL_VIEW)).scrollTo('top');
  await waitFor(element(by.id(TOP_MARKER))).toBeVisible().withTimeout(3000);
}

describeIfAndroid('Stack v5: nested-scroll interop seam (Android)', () => {
  beforeAll(async () => {
    await device.reloadReactNative();
    await selectSingleFeatureTestsScreen(
      'Stackv5',
      'test-stack-nested-scroll-interop-android',
    );
    await waitForRoute('Home');
    await waitFor(element(by.id(SCROLL_VIEW))).toBeVisible().withTimeout(5000);
    await waitFor(element(toolbar)).toBeVisible().withTimeout(5000);
  });

  it('forwards the real Stack v5 touch and momentum transaction without consuming it', async () => {
    await setMode('observe');
    await scrollToTop();

    await element(by.id(SCROLL_VIEW)).swipe('up', 'fast', 0.9);

    const snapshot = await readSnapshot();
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
    await setMode('observe');
    await scrollToTop();
    const expandedFrame = (await appBarAttributes()).frame;

    await setMode('consume');
    await element(by.id(SCROLL_VIEW)).swipe('up', 'slow', 0.9);

    const snapshot = await readSnapshot();
    const collapsedFrame = (await appBarAttributes()).frame;

    jestExpect(
      Math.abs(snapshot.delegateConsumedPreY) +
        Math.abs(snapshot.delegateConsumedPostY),
    ).toBeGreaterThan(0);
    jestExpect(snapshot.lastTargetScrollY).toBe(0);
    jestExpect(collapsedFrame.y).toBeLessThan(expandedFrame.y);
  });

  it('switches to the pushed screen source and restores the original source on Back', async () => {
    await setMode('observe');
    await scrollToTop();
    await element(by.id(SCROLL_VIEW)).swipe('up', 'slow', 0.6);
    const home = await readSnapshot();

    await element(by.id('nested-scroll-probe-push')).tap();
    await waitForRoute('Details');
    await element(by.id(SCROLL_VIEW)).swipe('up', 'slow', 0.6);
    const details = await readSnapshot();

    jestExpect(details.lastScreenId).not.toBe(home.lastScreenId);
    jestExpect(details.lastTargetId).not.toBe(home.lastTargetId);

    await device.pressBack();
    await waitForRoute('Home');
    await element(by.id(SCROLL_VIEW)).swipe('down', 'slow', 0.4);
    const restoredHome = await readSnapshot();

    jestExpect(restoredHome.lastScreenId).toBe(home.lastScreenId);
    jestExpect(restoredHome.lastTargetId).toBe(home.lastTargetId);
  });

  it('is behaviorally inert when the external delegate declines nested scroll', async () => {
    await setMode('observe');
    await scrollToTop();
    await setMode('disabled');

    await element(by.id(SCROLL_VIEW)).swipe('up', 'slow', 0.9);
    await element(by.id(SCROLL_VIEW)).swipe('up', 'slow', 0.9);

    const snapshot = await readSnapshot();
    jestExpect(snapshot.touchStarts).toBe(0);
    jestExpect(snapshot.nonTouchStarts).toBe(0);
    jestExpect(snapshot.touchPre).toBe(0);
    jestExpect(snapshot.nonTouchPre).toBe(0);
    jestExpect(snapshot.touchPost).toBe(0);
    jestExpect(snapshot.nonTouchPost).toBe(0);
    jestExpect(snapshot.delegateConsumedPreY).toBe(0);
    jestExpect(snapshot.delegateConsumedPostY).toBe(0);
    await expect(element(by.id(TOP_MARKER))).not.toBeVisible();
  });
});

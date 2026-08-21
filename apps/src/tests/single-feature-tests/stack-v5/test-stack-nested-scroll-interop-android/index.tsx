import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  NativeModules,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ScrollViewMarker,
  type StackHeaderConfigProps,
} from 'react-native-screens';
import {
  StackContainer,
  useStackNavigationContext,
} from '@apps/shared/containers/stack';
import LongText from '@apps/shared/LongText';
import { Colors } from '@apps/shared/styling';
import { createScenario } from '@apps/tests/shared/helpers';
import { scenarioDescription } from './scenario-description';

export type ProbeSnapshot = {
  sequence: number;
  delegatesCreated: number;
  attached: number;
  detached: number;
  layouts: number;
  touchStarts: number;
  nonTouchStarts: number;
  touchStops: number;
  nonTouchStops: number;
  touchPre: number;
  nonTouchPre: number;
  touchPost: number;
  nonTouchPost: number;
  preFlings: number;
  flings: number;
  delegateConsumedPreY: number;
  delegateConsumedPostY: number;
  lastScreenClass: string;
  lastScreenId: number;
  lastTargetClass: string;
  lastTargetId: number;
  lastTargetScrollY: number;
};

type ProbeModule = {
  configure(enabled: boolean, consumeRemaining: boolean): Promise<void>;
  reset(): Promise<void>;
  snapshot(): Promise<ProbeSnapshot>;
};

type ProbeMode = 'disabled' | 'observe' | 'consume';

const probe = NativeModules.NestedScrollInteropTest as ProbeModule;

const HEADER_CONFIG: StackHeaderConfigProps = {
  title: 'Nested scroll interop',
  android: {
    type: 'large',
    scrollFlagScroll: true,
    scrollFlagExitUntilCollapsed: true,
    scrollFlagEnterAlways: true,
  },
};

function TestStackNestedScrollInteropAndroid() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const prepare = async () => {
      await probe.configure(true, false);
      await probe.reset();
      if (mounted) {
        setReady(true);
      }
    };

    void prepare();

    return () => {
      mounted = false;
      void probe.configure(false, false);
    };
  }, []);

  if (!ready) {
    return <Text testID="nested-scroll-probe-boot">Preparing probe</Text>;
  }

  return (
    <StackContainer
      routeConfigs={[
        { name: 'Home', element: <ProbeScreen label="Home" /> },
        { name: 'Details', element: <ProbeScreen label="Details" /> },
      ]}
    />
  );
}

function ProbeScreen({ label }: { label: string }) {
  const { routeKey, setRouteOptions, push } = useStackNavigationContext();
  const [snapshot, setSnapshot] = useState<ProbeSnapshot | null>(null);
  const [mode, setMode] = useState<ProbeMode>('observe');

  useEffect(() => {
    setRouteOptions(routeKey, { headerConfig: HEADER_CONFIG });
  }, [routeKey, setRouteOptions]);

  const configure = useCallback(async (nextMode: ProbeMode) => {
    const enabled = nextMode !== 'disabled';
    await probe.configure(enabled, nextMode === 'consume');
    await probe.reset();
    setMode(nextMode);
    setSnapshot(null);
  }, []);

  const reset = useCallback(async () => {
    await probe.reset();
    setSnapshot(null);
  }, []);

  const refreshSnapshot = useCallback(async () => {
    setSnapshot(null);
    setSnapshot(await probe.snapshot());
  }, []);

  const snapshotText = useMemo(
    () => (snapshot == null ? 'none' : JSON.stringify(snapshot)),
    [snapshot],
  );

  return (
    <View style={styles.screen}>
      <View style={styles.probePanel}>
        <Text testID="nested-scroll-probe-route">{label}</Text>
        <Text testID="nested-scroll-probe-mode">{mode}</Text>
        <View style={styles.buttonRow}>
          <Button
            testID="nested-scroll-probe-observe"
            title="Observe"
            onPress={() => void configure('observe')}
          />
          <Button
            testID="nested-scroll-probe-consume"
            title="Consume remaining"
            onPress={() => void configure('consume')}
          />
          <Button
            testID="nested-scroll-probe-disable"
            title="Disable"
            onPress={() => void configure('disabled')}
          />
          <Button
            testID="nested-scroll-probe-reset"
            title="Reset"
            onPress={() => void reset()}
          />
          <Button
            testID="nested-scroll-probe-snapshot-button"
            title="Snapshot"
            onPress={() => void refreshSnapshot()}
          />
        </View>
        {label === 'Home' ? (
          <Button
            testID="nested-scroll-probe-push"
            title="Push details"
            onPress={() => push('Details')}
          />
        ) : null}
        <Text
          testID="nested-scroll-probe-snapshot"
          numberOfLines={1}
          style={styles.snapshot}>
          {snapshotText}
        </Text>
      </View>

      <ScrollViewMarker style={styles.scrollViewMarker}>
        <ScrollView
          testID="nested-scroll-probe-scrollview"
          nestedScrollEnabled
          style={styles.scroll}
          contentContainerStyle={styles.content}>
          <Text testID="nested-scroll-probe-top" style={styles.heading}>
            {label} content top
          </Text>
          <LongText size="xl" />
          <Text testID="nested-scroll-probe-bottom">{label} content bottom</Text>
        </ScrollView>
      </ScrollViewMarker>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  probePanel: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
    backgroundColor: Colors.cardBackground,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  snapshot: {
    fontSize: 10,
  },
  scrollViewMarker: {
    flex: 1,
  },
  scroll: {
    backgroundColor: Colors.cardBackground,
  },
  content: {
    padding: 16,
    gap: 8,
  },
  heading: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default createScenario(
  TestStackNestedScrollInteropAndroid,
  scenarioDescription,
);

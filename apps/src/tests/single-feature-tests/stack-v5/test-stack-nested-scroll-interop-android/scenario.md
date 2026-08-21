# Nested scroll interop (Android)

Validates the optional Android nested-scroll delegate seam on Stack v5 without depending on any external package.

The FabricExample app installs a test-only delegate. The delegate can either observe the transaction without consuming distance or consume every pixel left after `react-native-screens` has run its own CoordinatorLayout behaviors.

## Expected behavior

1. In **Observe** mode, a React Native `ScrollView` remains the source owner. Touch scroll and fling reach the external delegate, including `TYPE_NON_TOUCH` momentum callbacks, while the Stack v5 large header and content continue to move normally.
2. In **Consume remaining** mode, Stack v5 keeps first priority. Its large header can collapse, then the test delegate consumes the remaining distance before the child content moves.
3. Pushing `Details` creates a different screen/source pair. Popping back to `Home` restores the original pair.
4. The test delegate never owns source fling physics; fling handlers return `false`.

## E2E coverage

The Android e2e test asserts:

- the delegate is attached to `StackScreen`, not the legacy screen implementation;
- touch and non-touch nested-scroll callbacks are delivered;
- observe mode consumes zero distance and the React Native scroll view moves;
- consume mode receives only the remaining distance after Stack v5 and prevents the child from moving while the native header is allowed to react first;
- push/back switches to a new screen/source and restores the original source on return.

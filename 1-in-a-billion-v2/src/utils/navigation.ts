/**
 * Navigate to a screen with the standard slide animation, then clear the back stack.
 *
 * `navigation.reset()` is instant (no animation). This helper calls `navigate()`
 * first so the native push transition plays, then resets the stack after the
 * animation finishes (~500 ms) so the user cannot swipe back.
 */
export function navigateWithTransition(
    navigation: any,
    routeName: string,
    params?: Record<string, any>,
) {
    navigation.navigate(routeName, params);
    // Clear back stack after native iOS push animation completes
    setTimeout(() => {
        navigation.reset({
            index: 0,
            routes: [{ name: routeName, ...(params ? { params } : {}) }],
        });
    }, 500);
}

package com.swmansion.rnscreens.common.nestedscroll

import android.content.Context
import android.view.View
import android.view.ViewGroup
import androidx.coordinatorlayout.widget.CoordinatorLayout
import androidx.core.view.ViewCompat

/**
 * CoordinatorLayout that preserves its normal child-behavior dispatch and optionally forwards
 * the remaining nested-scroll transaction to an external screen delegate.
 */
internal abstract class ScreenNestedScrollCoordinatorLayout(
    context: Context,
    private val screen: ViewGroup,
) : CoordinatorLayout(context) {
    private val nestedScrollDelegate = ScreenNestedScrollInterop.createDelegate(screen)
    private val superAcceptedTypes = mutableSetOf<Int>()
    private val delegateAcceptedTypes = mutableSetOf<Int>()

    override fun getNestedScrollAxes(): Int = super.getNestedScrollAxes() or (nestedScrollDelegate?.getNestedScrollAxes() ?: 0)

    override fun onStartNestedScroll(
        child: View,
        target: View,
        axes: Int,
        type: Int,
    ): Boolean {
        val superAccepted = super.onStartNestedScroll(child, target, axes, type)
        val delegateAccepted = nestedScrollDelegate?.onStartNestedScroll(child, target, axes, type) == true

        if (superAccepted) superAcceptedTypes.add(type) else superAcceptedTypes.remove(type)
        if (delegateAccepted) delegateAcceptedTypes.add(type) else delegateAcceptedTypes.remove(type)

        return superAccepted || delegateAccepted
    }

    override fun onNestedScrollAccepted(
        child: View,
        target: View,
        axes: Int,
        type: Int,
    ) {
        if (type in superAcceptedTypes) {
            super.onNestedScrollAccepted(child, target, axes, type)
        }
        if (type in delegateAcceptedTypes) {
            nestedScrollDelegate?.onNestedScrollAccepted(child, target, axes, type)
        }
    }

    override fun onStopNestedScroll(
        target: View,
        type: Int,
    ) {
        if (type in superAcceptedTypes) {
            super.onStopNestedScroll(target, type)
        }
        if (type in delegateAcceptedTypes) {
            nestedScrollDelegate?.onStopNestedScroll(target, type)
        }
        superAcceptedTypes.remove(type)
        delegateAcceptedTypes.remove(type)
    }

    override fun onNestedPreScroll(
        target: View,
        dx: Int,
        dy: Int,
        consumed: IntArray,
        type: Int,
    ) {
        val consumedBeforeX = consumed[0]
        val consumedBeforeY = consumed[1]

        if (type in superAcceptedTypes) {
            super.onNestedPreScroll(target, dx, dy, consumed, type)
        }

        if (type in delegateAcceptedTypes) {
            val consumedBySuperX = consumed[0] - consumedBeforeX
            val consumedBySuperY = consumed[1] - consumedBeforeY
            val remainingX = dx - consumedBySuperX
            val remainingY = dy - consumedBySuperY
            val delegateConsumed = IntArray(2)

            nestedScrollDelegate?.onNestedPreScroll(
                target,
                remainingX,
                remainingY,
                delegateConsumed,
                type,
            )

            consumed[0] += delegateConsumed[0]
            consumed[1] += delegateConsumed[1]
        }
    }

    override fun onNestedScroll(
        target: View,
        dxConsumed: Int,
        dyConsumed: Int,
        dxUnconsumed: Int,
        dyUnconsumed: Int,
        type: Int,
        consumed: IntArray,
    ) {
        val consumedBeforeX = consumed[0]
        val consumedBeforeY = consumed[1]

        if (type in superAcceptedTypes) {
            super.onNestedScroll(
                target,
                dxConsumed,
                dyConsumed,
                dxUnconsumed,
                dyUnconsumed,
                type,
                consumed,
            )
        }

        if (type in delegateAcceptedTypes) {
            val consumedBySuperX = consumed[0] - consumedBeforeX
            val consumedBySuperY = consumed[1] - consumedBeforeY
            val remainingX = dxUnconsumed - consumedBySuperX
            val remainingY = dyUnconsumed - consumedBySuperY
            val delegateConsumed = IntArray(2)

            nestedScrollDelegate?.onNestedScroll(
                target,
                dxConsumed,
                dyConsumed,
                remainingX,
                remainingY,
                type,
                delegateConsumed,
            )

            consumed[0] += delegateConsumed[0]
            consumed[1] += delegateConsumed[1]
        }
    }

    override fun onNestedPreFling(
        target: View,
        velocityX: Float,
        velocityY: Float,
    ): Boolean {
        val superConsumed =
            ViewCompat.TYPE_TOUCH in superAcceptedTypes &&
                super.onNestedPreFling(target, velocityX, velocityY)

        if (superConsumed) {
            return true
        }

        return ViewCompat.TYPE_TOUCH in delegateAcceptedTypes &&
            nestedScrollDelegate?.onNestedPreFling(target, velocityX, velocityY) == true
    }

    override fun onNestedFling(
        target: View,
        velocityX: Float,
        velocityY: Float,
        consumed: Boolean,
    ): Boolean {
        val handledBySuper =
            ViewCompat.TYPE_TOUCH in superAcceptedTypes &&
                super.onNestedFling(target, velocityX, velocityY, consumed)
        val handledByDelegate =
            ViewCompat.TYPE_TOUCH in delegateAcceptedTypes &&
                nestedScrollDelegate?.onNestedFling(target, velocityX, velocityY, consumed) == true

        return handledBySuper || handledByDelegate
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        nestedScrollDelegate?.onScreenAttached(screen)
    }

    override fun onDetachedFromWindow() {
        nestedScrollDelegate?.onScreenDetached(screen)
        superAcceptedTypes.clear()
        delegateAcceptedTypes.clear()
        super.onDetachedFromWindow()
    }

    override fun onLayout(
        changed: Boolean,
        left: Int,
        top: Int,
        right: Int,
        bottom: Int,
    ) {
        super.onLayout(changed, left, top, right, bottom)
        nestedScrollDelegate?.onScreenLayout(screen)
    }
}

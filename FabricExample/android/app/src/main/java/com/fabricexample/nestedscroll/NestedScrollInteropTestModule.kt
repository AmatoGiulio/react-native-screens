package com.fabricexample.nestedscroll

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NestedScrollInteropTestModule(
    reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String = NAME

    @ReactMethod
    fun configure(
        enabled: Boolean,
        consumeRemaining: Boolean,
        promise: Promise,
    ) {
        NestedScrollInteropTestProbe.configure(enabled, consumeRemaining)
        promise.resolve(null)
    }

    @ReactMethod
    fun reset(promise: Promise) {
        NestedScrollInteropTestProbe.reset()
        promise.resolve(null)
    }

    @ReactMethod
    fun snapshot(promise: Promise) {
        val snapshot = NestedScrollInteropTestProbe.snapshot()
        val map = Arguments.createMap().apply {
            putInt("delegatesCreated", snapshot.delegatesCreated)
            putInt("attached", snapshot.attached)
            putInt("detached", snapshot.detached)
            putInt("layouts", snapshot.layouts)
            putInt("touchStarts", snapshot.touchStarts)
            putInt("nonTouchStarts", snapshot.nonTouchStarts)
            putInt("touchStops", snapshot.touchStops)
            putInt("nonTouchStops", snapshot.nonTouchStops)
            putInt("touchPre", snapshot.touchPre)
            putInt("nonTouchPre", snapshot.nonTouchPre)
            putInt("touchPost", snapshot.touchPost)
            putInt("nonTouchPost", snapshot.nonTouchPost)
            putInt("preFlings", snapshot.preFlings)
            putInt("flings", snapshot.flings)
            putDouble("delegateConsumedPreY", snapshot.delegateConsumedPreY.toDouble())
            putDouble("delegateConsumedPostY", snapshot.delegateConsumedPostY.toDouble())
            putString("lastScreenClass", snapshot.lastScreenClass)
            putInt("lastScreenId", snapshot.lastScreenId)
            putString("lastTargetClass", snapshot.lastTargetClass)
            putInt("lastTargetId", snapshot.lastTargetId)
            putInt("lastTargetScrollY", snapshot.lastTargetScrollY)
        }
        promise.resolve(map)
    }

    companion object {
        const val NAME = "NestedScrollInteropTest"
    }
}

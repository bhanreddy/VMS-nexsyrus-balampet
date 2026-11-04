package com.swmansion.rnscreens

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.uimanager.DisplayMetricsHolder
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.views.swiperefresh.ReactSwipeRefreshLayout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

// Exercise the actual AndroidX drawing-order cache and Screens removal path.
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class RefreshControlTransitionTest {
    private lateinit var activity: Activity
    private lateinit var reactContext: BridgeReactContext

    @Before
    fun setUp() {
        activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        DisplayMetricsHolder.initDisplayMetricsIfNotInitialized(activity)
        reactContext = BridgeReactContext(RuntimeEnvironment.getApplication())
    }

    @Test
    fun oldFillerPlacementReproducesInvalidDrawingIndex() {
        val refreshLayout = ReactSwipeRefreshLayout(reactContext)
        val content = View(activity)
        refreshLayout.addView(content, 0)
        activity.setContentView(refreshLayout)
        layOut(refreshLayout)
        assertEquals(1, circleIndex(refreshLayout))

        // Previous Screens behavior moves the spinner before caching its index.
        refreshLayout.addView(View(activity), circleIndex(refreshLayout))
        layOut(refreshLayout)
        assertEquals(2, circleIndex(refreshLayout))
        refreshLayout.startViewTransition(content)
        refreshLayout.removeView(content)
        assertEquals(2, refreshLayout.childCount)

        val error = assertThrows(IndexOutOfBoundsException::class.java) {
            draw(refreshLayout)
        }
        assertTrue(error.message.orEmpty().contains("getChildDrawingOrder() returned invalid index 2"))
    }

    @Test
    fun screenRemovalKeepsRefreshControlDrawingOrderValid() {
        val screen = Screen(ThemedReactContext(reactContext, activity, null, -1))
        val refreshLayout = ReactSwipeRefreshLayout(reactContext)
        val content = View(activity)
        refreshLayout.addView(content, 0)
        screen.addView(refreshLayout)
        activity.setContentView(screen)
        layOut(refreshLayout)

        screen.startRemovalTransition()
        assertEquals(3, refreshLayout.childCount)
        // Simulate a layout while transitioning, followed by content removal
        // before another measure. This is the production crash's timing window.
        layOut(refreshLayout)
        refreshLayout.removeView(content)
        assertEquals(2, refreshLayout.childCount)

        draw(refreshLayout)
        draw(screen)
    }

    private fun circleIndex(parent: ViewGroup): Int =
        (0 until parent.childCount).first { parent.getChildAt(it) is ImageView }

    private fun layOut(view: View) {
        view.measure(
            View.MeasureSpec.makeMeasureSpec(320, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(640, View.MeasureSpec.EXACTLY),
        )
        view.layout(0, 0, 320, 640)
    }

    private fun draw(view: View) {
        val bitmap = Bitmap.createBitmap(320, 640, Bitmap.Config.ARGB_8888)
        try {
            view.draw(Canvas(bitmap))
        } finally {
            bitmap.recycle()
        }
    }
}

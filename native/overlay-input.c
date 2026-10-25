#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <commctrl.h>

static LRESULT CALLBACK OverlayProc(HWND window, UINT message, WPARAM wParam,
                                   LPARAM lParam, UINT_PTR id, DWORD_PTR data) {
    (void)data;
    // Keep mouse-down events without activating the game overlay. Forward native
    // move/resize loops entirely in C: reentering V8 through an FFI callback crashes.
    if (message == WM_MOUSEACTIVATE) return MA_NOACTIVATE;
    if (message == WM_NCDESTROY) RemoveWindowSubclass(window, OverlayProc, id);
    return DefSubclassProc(window, message, wParam, lParam);
}

__declspec(dllexport) BOOL __stdcall CompanionAttachOverlay(HWND window) {
    return SetWindowSubclass(window, OverlayProc, 1, 0);
}

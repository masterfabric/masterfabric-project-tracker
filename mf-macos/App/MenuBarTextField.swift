import AppKit
import SwiftUI

/// AppKit text field that reliably accepts typing inside `MenuBarExtra` windows
/// (SwiftUI `TextField` often never becomes first responder there).
struct MenuBarTextField: NSViewRepresentable {
    @Binding var text: String
    var placeholder: String
    var onSubmit: (() -> Void)?
    /// Fired on every keystroke on the main queue so SwiftUI can enable buttons immediately.
    var onTextChange: ((String) -> Void)?

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeNSView(context: Context) -> MenuBarNSTextField {
        let field = MenuBarNSTextField(string: text)
        field.placeholderString = placeholder
        field.delegate = context.coordinator
        field.isBordered = true
        field.isBezeled = true
        field.bezelStyle = .roundedBezel
        // Default focus ring draws outside the view bounds and steals clicks from
        // neighboring SwiftUI buttons (e.g. Chat Send) inside MenuBarExtra.
        field.focusRingType = .none
        field.font = .systemFont(ofSize: NSFont.systemFontSize)
        field.lineBreakMode = .byTruncatingTail
        field.cell?.wraps = false
        field.cell?.isScrollable = true
        field.cell?.usesSingleLineMode = true
        field.target = context.coordinator
        field.action = #selector(Coordinator.submitted(_:))
        field.setContentHuggingPriority(.defaultLow, for: .horizontal)
        field.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        field.setContentHuggingPriority(.required, for: .vertical)
        field.setContentCompressionResistancePriority(.required, for: .vertical)
        return field
    }

    func updateNSView(_ nsView: MenuBarNSTextField, context: Context) {
        context.coordinator.parent = self
        if nsView.placeholderString != placeholder {
            nsView.placeholderString = placeholder
        }
        // While editing, never fight the field — only push external clears/resets.
        if nsView.currentEditor() == nil, nsView.stringValue != text {
            nsView.stringValue = text
        } else if nsView.currentEditor() != nil, text.isEmpty, !nsView.stringValue.isEmpty {
            // Parent cleared the binding (e.g. after Send / login success) — resign and clear.
            nsView.window?.makeFirstResponder(nil)
            nsView.stringValue = ""
        }
    }

    final class Coordinator: NSObject, NSTextFieldDelegate {
        var parent: MenuBarTextField

        init(_ parent: MenuBarTextField) {
            self.parent = parent
        }

        private func pushText(_ value: String) {
            // Keep binding updates synchronous for AX setValue + enable Add in the same turn.
            if parent.text != value {
                parent.text = value
            }
            parent.onTextChange?(value)
        }

        func controlTextDidChange(_ obj: Notification) {
            guard let field = obj.object as? NSTextField else { return }
            pushText(field.stringValue)
        }

        func controlTextDidEndEditing(_ obj: Notification) {
            guard let field = obj.object as? NSTextField else { return }
            pushText(field.stringValue)
        }

        func controlTextDidBeginEditing(_ obj: Notification) {
            NSApp.activate(ignoringOtherApps: true)
            if let field = obj.object as? NSTextField {
                field.window?.makeKeyAndOrderFront(nil)
            }
        }

        @objc func submitted(_ sender: NSTextField) {
            let value = sender.stringValue
            parent.text = value
            parent.onTextChange?(value)
            parent.onSubmit?()
        }

        func control(_ control: NSControl, textView: NSTextView, doCommandBy commandSelector: Selector) -> Bool {
            if commandSelector == #selector(NSResponder.insertNewline(_:)) {
                let value = (control as? NSTextField)?.stringValue ?? parent.text
                parent.text = value
                parent.onTextChange?(value)
                parent.onSubmit?()
                return true
            }
            return false
        }
    }
}

final class MenuBarNSTextField: NSTextField {
    override var acceptsFirstResponder: Bool { true }

    /// AX / UI-test `setValue` often assigns `stringValue` — push into SwiftUI bindings.
    override var stringValue: String {
        get { super.stringValue }
        set {
            let old = super.stringValue
            super.stringValue = newValue
            if old != newValue {
                notifySwiftUIBinding()
            }
        }
    }

    override func accessibilitySetValue(_ value: Any?, forAttribute attribute: NSAccessibility.Attribute) {
        if attribute == .value, let s = value as? String {
            stringValue = s
            return
        }
        super.accessibilitySetValue(value, forAttribute: attribute)
        if attribute == .value {
            notifySwiftUIBinding()
        }
    }

    private func notifySwiftUIBinding() {
        if let del = delegate as? NSTextFieldDelegate {
            del.controlTextDidChange?(Notification(name: NSControl.textDidChangeNotification, object: self))
        }
        NotificationCenter.default.post(name: NSControl.textDidChangeNotification, object: self)
    }

    override func mouseDown(with event: NSEvent) {
        NSApp.activate(ignoringOtherApps: true)
        window?.makeKeyAndOrderFront(nil)
        window?.makeFirstResponder(self)
        super.mouseDown(with: event)
    }

    override func becomeFirstResponder() -> Bool {
        let ok = super.becomeFirstResponder()
        if ok {
            currentEditor()?.selectedRange = NSRange(location: stringValue.count, length: 0)
        }
        return ok
    }

    /// Keep the field's hit target inside its laid-out frame so siblings stay clickable.
    override func hitTest(_ point: NSPoint) -> NSView? {
        guard isHidden == false, alphaValue > 0.01 else { return nil }
        return bounds.contains(point) ? super.hitTest(point) : nil
    }
}

/// AppKit secure field for Sign In — SwiftUI `SecureField` often never binds inside NSPopover / MenuBarExtra.
struct MenuBarSecureField: NSViewRepresentable {
    @Binding var text: String
    var placeholder: String
    var onSubmit: (() -> Void)?
    var onTextChange: ((String) -> Void)?

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeNSView(context: Context) -> MenuBarNSSecureTextField {
        let field = MenuBarNSSecureTextField(string: text)
        field.placeholderString = placeholder
        field.delegate = context.coordinator
        field.isBordered = true
        field.isBezeled = true
        field.bezelStyle = .roundedBezel
        field.focusRingType = .none
        field.font = .systemFont(ofSize: NSFont.systemFontSize)
        field.lineBreakMode = .byTruncatingTail
        field.cell?.wraps = false
        field.cell?.isScrollable = true
        field.cell?.usesSingleLineMode = true
        field.target = context.coordinator
        field.action = #selector(Coordinator.submitted(_:))
        field.setContentHuggingPriority(.defaultLow, for: .horizontal)
        field.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        field.setContentHuggingPriority(.required, for: .vertical)
        field.setContentCompressionResistancePriority(.required, for: .vertical)
        field.setAccessibilityLabel("Password")
        return field
    }

    func updateNSView(_ nsView: MenuBarNSSecureTextField, context: Context) {
        context.coordinator.parent = self
        if nsView.placeholderString != placeholder {
            nsView.placeholderString = placeholder
        }
        if nsView.currentEditor() == nil, nsView.stringValue != text {
            nsView.stringValue = text
        } else if nsView.currentEditor() != nil, text.isEmpty, !nsView.stringValue.isEmpty {
            nsView.window?.makeFirstResponder(nil)
            nsView.stringValue = ""
        }
    }

    final class Coordinator: NSObject, NSTextFieldDelegate {
        var parent: MenuBarSecureField

        init(_ parent: MenuBarSecureField) {
            self.parent = parent
        }

        private func pushText(_ value: String) {
            if parent.text != value {
                parent.text = value
            }
            parent.onTextChange?(value)
        }

        func controlTextDidChange(_ obj: Notification) {
            guard let field = obj.object as? NSTextField else { return }
            pushText(field.stringValue)
        }

        func controlTextDidEndEditing(_ obj: Notification) {
            guard let field = obj.object as? NSTextField else { return }
            pushText(field.stringValue)
        }

        func controlTextDidBeginEditing(_ obj: Notification) {
            NSApp.activate(ignoringOtherApps: true)
            if let field = obj.object as? NSTextField {
                field.window?.makeKeyAndOrderFront(nil)
            }
        }

        @objc func submitted(_ sender: NSTextField) {
            parent.text = sender.stringValue
            parent.onTextChange?(sender.stringValue)
            parent.onSubmit?()
        }

        func control(_ control: NSControl, textView: NSTextView, doCommandBy commandSelector: Selector) -> Bool {
            if commandSelector == #selector(NSResponder.insertNewline(_:)) {
                let value = (control as? NSTextField)?.stringValue ?? parent.text
                parent.text = value
                parent.onTextChange?(value)
                parent.onSubmit?()
                return true
            }
            return false
        }
    }
}

final class MenuBarNSSecureTextField: NSSecureTextField {
    override var acceptsFirstResponder: Bool { true }

    override var stringValue: String {
        get { super.stringValue }
        set {
            let old = super.stringValue
            super.stringValue = newValue
            if old != newValue {
                notifySwiftUIBinding()
            }
        }
    }

    override func accessibilitySetValue(_ value: Any?, forAttribute attribute: NSAccessibility.Attribute) {
        if attribute == .value, let s = value as? String {
            stringValue = s
            return
        }
        super.accessibilitySetValue(value, forAttribute: attribute)
        if attribute == .value {
            notifySwiftUIBinding()
        }
    }

    private func notifySwiftUIBinding() {
        if let del = delegate as? NSTextFieldDelegate {
            del.controlTextDidChange?(Notification(name: NSControl.textDidChangeNotification, object: self))
        }
        NotificationCenter.default.post(name: NSControl.textDidChangeNotification, object: self)
    }

    override func mouseDown(with event: NSEvent) {
        NSApp.activate(ignoringOtherApps: true)
        window?.makeKeyAndOrderFront(nil)
        window?.makeFirstResponder(self)
        super.mouseDown(with: event)
    }

    override func becomeFirstResponder() -> Bool {
        let ok = super.becomeFirstResponder()
        if ok {
            currentEditor()?.selectedRange = NSRange(location: stringValue.count, length: 0)
        }
        return ok
    }

    override func hitTest(_ point: NSPoint) -> NSView? {
        guard isHidden == false, alphaValue > 0.01 else { return nil }
        return bounds.contains(point) ? super.hitTest(point) : nil
    }
}

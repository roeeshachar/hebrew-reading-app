import Capacitor
import Speech
import AVFoundation

/// Listens once through Apple's speech recognition (the child reads a word aloud).
/// JS: Speech.listen({ lang, timeoutMs }) -> { alternatives: string[], error: string|null }
@objc(SpeechPlugin)
public class SpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SpeechPlugin"
    public let jsName = "Speech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listen", returnType: CAPPluginReturnPromise),
    ]

    private var engine: AVAudioEngine?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var timer: Timer?
    private var finished = true

    @objc func available(_ call: CAPPluginCall) {
        let recognizer = SFSpeechRecognizer(locale: Locale(identifier: call.getString("lang") ?? "he-IL"))
        call.resolve(["available": recognizer?.isAvailable ?? false])
    }

    @objc func listen(_ call: CAPPluginCall) {
        let lang = call.getString("lang") ?? "he-IL"
        let timeout = (call.getDouble("timeoutMs") ?? 8000) / 1000
        stopEverything()

        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else {
                return call.resolve(["alternatives": [], "error": "not-allowed"])
            }
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                DispatchQueue.main.async {
                    guard granted else {
                        return call.resolve(["alternatives": [], "error": "not-allowed"])
                    }
                    self.start(call, lang: lang, timeout: timeout)
                }
            }
        }
    }

    private func start(_ call: CAPPluginCall, lang: String, timeout: TimeInterval) {
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: lang)), recognizer.isAvailable else {
            return call.resolve(["alternatives": [], "error": "unsupported"])
        }
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            return call.resolve(["alternatives": [], "error": "audio-capture"])
        }

        let engine = AVAudioEngine()
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = false
        self.engine = engine
        self.request = request
        finished = false
        var alternatives: [String] = []
        var failure: String? = nil

        let finish = { [weak self] in
            guard let self = self, !self.finished else { return }
            self.finished = true
            self.stopEverything()
            call.resolve(["alternatives": alternatives, "error": failure as Any])
        }

        task = recognizer.recognitionTask(with: request) { result, error in
            if let result = result {
                alternatives = result.transcriptions.map { $0.formattedString }
                if result.isFinal { finish() }
            }
            if error != nil {
                if alternatives.isEmpty { failure = "no-speech" }
                finish()
            }
        }

        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }
        engine.prepare()
        do { try engine.start() } catch {
            failure = "audio-capture"
            return finish()
        }

        timer = Timer.scheduledTimer(withTimeInterval: timeout, repeats: false) { [weak self] _ in
            // Ending the audio makes the recognizer deliver its final result.
            self?.request?.endAudio()
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { finish() }
        }
    }

    private func stopEverything() {
        timer?.invalidate(); timer = nil
        engine?.inputNode.removeTap(onBus: 0)
        engine?.stop(); engine = nil
        request?.endAudio(); request = nil
        task?.cancel(); task = nil
        // Back to playback so the clips are audible even with the mute switch on.
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .default, options: [])
        try? session.setActive(true)
    }
}

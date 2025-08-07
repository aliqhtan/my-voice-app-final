import React, { useState } from 'react';
import { Bot, Send, Volume2, Loader, Mic, ChevronDown } from 'lucide-react';

// --- قائمة الأصوات المتاحة مع أسماء وصفية ---
const availableVoices = [
  { id: 'Iapetus', name: 'صوت قرآني (واضح ومهيب)' },
  { id: 'Gacrux', name: 'الراوي الوثائقي (ناضج)' },
  { id: 'Algenib', name: 'صوت عميق (رخيم)' },
  { id: 'Schedar', name: 'الراوي الهادئ (متزن)' },
  { id: 'Orus', name: 'صوت حازم (قوي)' },
];

// --- المكون الرئيسي للتطبيق ---
export default function App() {
  const [text, setText] = useState('بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ');
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [error, setError] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(availableVoices[0].id); // Default to the Quranic voice

  // --- دالة لتحويل بيانات الصوت الخام إلى ملف WAV قابل للتشغيل ---
  const pcmToWav = (pcmData, sampleRate) => {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    const pcmLength = pcmData.byteLength;
    const totalLength = pcmLength + 36;
    const channels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * channels * (bitsPerSample / 8);

    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, totalLength, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true); // Sub-chunk size
    view.setUint16(20, 1, true); // Audio format (1 for PCM)
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, channels * (bitsPerSample / 8), true); // Block align
    view.setUint16(34, bitsPerSample, true);
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, pcmLength, true);
    const wavBlob = new Blob([header, pcmData], { type: 'audio/wav' });
    return URL.createObjectURL(wavBlob);
  };
  
  // --- دالة لفك تشفير Base64 ---
  const base64ToArrayBuffer = (base64) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };


  // --- دالة استدعاء Gemini API لإنشاء الصوت ---
  const handleGenerateSpeech = async () => {
    if (!text.trim()) {
      setError('يرجى كتابة نص أولاً.');
      return;
    }
    setIsLoading(true);
    setError('');
    setAudioUrl('');

    let instructionPrompt;

    if (selectedVoice === 'Iapetus') {
        instructionPrompt = `تحدث بهذا النص بصوت فخم وواضح، وبنبرة هادئة ومهيبة. استخدم وقفات طبيعية للتنفس والتأكيد لجعل الكلام واقعياً ومؤثراً، لكن بدون تجويد أو ترتيل. اقرأ فقط النص التالي: ${text}`;
    } else {
        instructionPrompt = `تصرف كمعلق صوتي محترف وموهوب. مهمتك هي أن تبث الحياة في النص التالي. لا تقرأه فحسب، بل اروِه. استخدم نبرة صوت طبيعية ودافئة، مع وقفات محسوبة للتنفس والتأكيد. غيّر في سرعة كلامك ونبرتك بمهارة لتجسيد المشاعر في النص. تحدث بلغة عربية فصيحة وواضحة. النص هو: ${text}`;
    }
    
    // **تم الإصلاح هنا**
    // يقرأ المفتاح السري من إعدادات Vercel أو يستخدم قيمة فارغة في بيئة المعاينة.
    const apiKey = (typeof process !== 'undefined' && process.env.REACT_APP_GEMINI_API_KEY) || "";

    const payload = {
        contents: [{
            parts: [{ text: instructionPrompt }]
        }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: selectedVoice }
                }
            }
        },
        model: "gemini-2.5-flash-preview-tts"
    };

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`API call failed with status: ${response.status}`);
        }

        const result = await response.json();
        const part = result?.candidates?.[0]?.content?.parts?.[0];
        const audioData = part?.inlineData?.data;
        const mimeType = part?.inlineData?.mimeType;

        if (audioData && mimeType && mimeType.startsWith("audio/")) {
            const sampleRateMatch = mimeType.match(/rate=(\d+)/);
            const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : 24000;
            const pcmData = base64ToArrayBuffer(audioData);
            const wavUrl = pcmToWav(pcmData, sampleRate);
            setAudioUrl(wavUrl);
        } else {
            throw new Error("لم يتم العثور على بيانات صوتية في الاستجابة.");
        }

    } catch (e) {
      console.error("Error generating speech:", e);
      setError('حدث خطأ أثناء إنشاء الصوت. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 font-cairo" dir="rtl">
      <div className="w-full max-w-2xl bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8">
        
        <div className="flex items-center mb-4">
          <div className="p-3 bg-indigo-600 rounded-full">
            <Mic size={24} className="text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mr-4">المعلق الصوتي الذكي</h1>
        </div>
        <p className="text-gray-400 mb-6">
          اكتب أي نص، اختر صوت المعلق، واستمع إلى تعليق صوتي احترافي.
        </p>

        <div className="bg-gray-900 p-4 rounded-lg">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-40 bg-transparent text-white placeholder-gray-500 text-lg p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="اكتب النص هنا..."
          />
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-1">
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="w-full appearance-none bg-gray-700 text-white font-bold py-4 px-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {availableVoices.map(voice => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-3 text-gray-400">
                <ChevronDown size={20} />
            </div>
          </div>
          <button
            onClick={handleGenerateSpeech}
            disabled={isLoading}
            className="w-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-bold py-4 px-4 rounded-lg transition-all duration-300 text-lg md:col-span-2"
          >
            {isLoading ? (
              <>
                <Loader className="animate-spin ml-2" size={24} />
                <span>جاري إنشاء الصوت...</span>
              </>
            ) : (
              <>
                <Volume2 className="ml-2" size={24} />
                <span>استمع الآن</span>
              </>
            )}
          </button>
        </div>

        {error && <p className="text-red-400 mt-4 text-center">{error}</p>}

        {audioUrl && (
          <div className="mt-6 p-4 bg-gray-700 rounded-lg">
            <audio controls autoPlay src={audioUrl} className="w-full">
              Your browser does not support the audio element.
            </audio>
          </div>
        )}
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
        .font-cairo {
          font-family: 'Cairo', sans-serif;
        }
      `}</style>
    </div>
  );
}

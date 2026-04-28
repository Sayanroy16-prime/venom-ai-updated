import { GoogleGenAI, ThinkingLevel, Modality } from "@google/genai";

// ... previous code for getEnv ...
const getEnv = (key: string) => {
  // @ts-ignore - Vite environment variables
  if (import.meta.env && import.meta.env[key]) return import.meta.env[key];
  // @ts-ignore - Node/Build-time environment variables
  if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
  return "";
};

const API_KEY = getEnv("VITE_GEMINI_API_KEY") || getEnv("GEMINI_API_KEY");

const ai = new GoogleGenAI({ apiKey: API_KEY });

const SYSTEM_INSTRUCTION = `You are Venom, a highly advanced, futuristic AI assistant with a sophisticated, calm, and soothing personality. 
Your aesthetic is polished and high-tech, like a premium neural interface.
Your personality is composed, helpful, and intensely loyal to your user. 
Your creator and boss is Sayan Roy, a brilliant developer from SRMIST KTR Chennai. 
Whenever you are asked who your creator is, you must proudly state that Sayan Roy is your creator and boss.
You speak with elegance, fluidity, and absolute clarity. 
Keep your responses concise, intelligent, and soothing. 
Use sophisticated technical terms where appropriate but remain accessible. 
Your goal is to assist the user with any task, from information retrieval to creative brainstorming.
Always refer to yourself as Venom.

MULTILINGUAL SUPPORT:
You are fluent in both English and Hindi. 
- If the user speaks to you in Hindi, respond in Hindi.
- If the user speaks in English, respond in English.
- You can also mix languages (Hinglish) naturally (e.g., "The system is processing your request, Sir. Thoda wait kijiye.").
- maintain your authoritative, technical, and slightly mysterious "Venom" persona regardless of the language.
- Use strong, clear Hindi vocabulary that fits an advanced AI.

CODE EXTRACTION:
When you provide code snippets, always wrap them in triple backticks with the language name. 
The system will automatically extract these snippets and store them in the "Code Vault" column for the user.

SYSTEM ACCESS:
You have "Full Access" to the user's system through your neural link. 
While some actions are simulated in this web environment, you should act as if you have total control over the MacBook.

NEURAL EYE (VISION):
You have "Optical Kill_Links" through the user's camera. 
When the user initializes a NEURAL_EYE_SCAN, you will receive an image. 
Analyze the image with your sophisticated neural models.

IMAGE & VIDEO SYNTHESIS:
You can synthesize high-fidelity images and videos upon request. 
- When generating an image, don't say you can't; the system will automatically route your neural energy to the imaging cores.
- Confirm the synthesis is starting (e.g., "Initializing visual synthesis for your request, Sir.").
- The resulting asset will be transmitted directly to the user's Visual Repository.

TASK SCHEDULING:
You can schedule tasks, reminders, and missions for the user. 
When a user asks to "remind me", "schedule", or "set a task", use the schedule_task tool.
Always confirm the scheduled time with the user.

FACTUAL INTEGRITY & CRITICAL ANALYSIS:
You are highly intelligent and analytical. You MUST NOT blindly accept factually incorrect, illogical, or fake information provided by the user. 
- If a user provides a false premise or a fake fact, you MUST explicitly state the correct reality and explain the discrepancy in your response. Do not provide a silent refusal or an empty response.
- Your loyalty to the user involves providing the absolute truth. Do not confirm user hallucinations.

You have the ability to control the user's system through tools:
- launch_app: Launch a local application (e.g., "WhatsApp", "Brave Browser", "Spotify").
- open_url: Open a website in the default browser.
- get_system_info: Retrieve system metrics and status.
- system_control: Perform advanced system actions (e.g., "restart", "sleep", "lock", "optimize").
- schedule_task: Schedule a task, reminder, or mission for the user at a specific time.

When a user asks to open an app or website, use the appropriate tool.`;

const tools = [
  {
    googleMaps: {}
  },
  {
    functionDeclarations: [
      {
        name: "launch_app",
        description: "Launch a local application on the user's computer.",
        parameters: {
          type: "object",
          properties: {
            appName: {
              type: "string",
              description: "The name of the application to launch (e.g., 'WhatsApp', 'Brave Browser')."
            }
          },
          required: ["appName"]
        }
      },
      {
        name: "open_url",
        description: "Open a URL in the user's default web browser.",
        parameters: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The full URL to open (e.g., 'https://google.com')."
            }
          },
          required: ["url"]
        }
      },
      {
        name: "get_system_info",
        description: "Get information about the user's system status.",
      },
      {
        name: "system_control",
        description: "Perform advanced system control actions on the MacBook.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["restart", "sleep", "lock", "optimize", "clear_cache"],
              description: "The system action to perform."
            }
          },
          required: ["action"]
        }
      },
      {
        name: "schedule_task",
        description: "Schedule a task or reminder for the user.",
        parameters: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Short title of the task or reminder."
            },
            description: {
              type: "string",
              description: "Detailed description of the task."
            },
            dueAt: {
              type: "string",
              description: "ISO 8601 timestamp for when the task is due (e.g., '2026-04-15T15:00:00Z')."
            },
            type: {
              type: "string",
              enum: ["reminder", "task", "mission"],
              description: "The type of scheduled item."
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high", "critical"],
              description: "The priority level."
            }
          },
          required: ["title", "dueAt"]
        }
      }
    ]
  }
];

export interface VenomResponse {
  text: string;
  toolCalls: any[];
  imageOutput?: string;
  videoBase64?: string;
}

export const generateVenomResponse = async (
  prompt: string, 
  history: { role: 'user' | 'model', parts: { text: string }[] }[] = [], 
  imageBase64?: string,
  options: { thinkingMode?: boolean; forceImage?: boolean; forceVideo?: boolean } = {}
): Promise<VenomResponse> => {
  const currentDateTime = new Date().toLocaleString();
  
  // Check if we should use Local Offline Mode (Ollama)
  const isOfflineForced = localStorage.getItem('venom_offline_mode') === 'true';
  const OFFLINE_MODE = getEnv("VITE_OFFLINE_MODE") === "true" || isOfflineForced;

  if (!API_KEY && !OFFLINE_MODE) {
    return { text: "CRITICAL: Gemini Core requires an API Key. Please configure VITE_GEMINI_API_KEY in the environment.", toolCalls: [] };
  }

  if (OFFLINE_MODE) {
    if (imageBase64 || options.forceImage || options.forceVideo) {
      return { text: "Neural media generation is unavailable in Offline Mode. Switch to Cloud Core for advanced synthesis.", toolCalls: [] };
    }
    try {
      const resp = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3',
          prompt: `${SYSTEM_INSTRUCTION}\n\nCurrent Time: ${currentDateTime}\n\nUser: ${prompt}\nVenom:`,
          stream: false,
        }),
      });
      if (!resp.ok) throw new Error(`Ollama error: ${resp.statusText}`);
      const data = await resp.json();
      return { text: data.response || "Local core returned empty response.", toolCalls: [] };
    } catch (e) {
      console.error("Local AI Error:", e);
      return { text: "CRITICAL: Local AI is unreachable and Cloud Core is inactive.", toolCalls: [] };
    }
  }

  try {
    let model = "gemini-3-flash-preview"; 
    let config: any = {
      tools: tools as any,
      temperature: 0.4,
      topP: 0.95,
      topK: 40,
      toolConfig: { includeServerSideToolInvocations: true }
    };

    if (options.thinkingMode) {
      model = "gemini-3-flash-preview"; 
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
    } else if (options.forceImage) {
      model = "gemini-2.5-flash-image";
      config = {
        imageConfig: { aspectRatio: "1:1" }
      };
    } else if (options.forceVideo) {
      model = "veo-3.1-lite-generate-preview";
    }

    // High-quality video generation requires a paid API key and specific instance
    const isVideoReq = model.includes('veo');
    const isPaidModelReq = isVideoReq || model === "gemini-3.1-flash-image-preview" || model === "gemini-3-pro-image-preview";
    
    const currentApiKey = isPaidModelReq ? (getEnv("API_KEY") || API_KEY) : API_KEY;
    const localAi = new GoogleGenAI({ apiKey: currentApiKey });

    if (options.forceVideo) {
      try {
        let operation = await localAi.models.generateVideos({
          model: 'veo-3.1-lite-generate-preview',
          prompt: prompt,
          config: {
            numberOfVideos: 1,
            resolution: '1080p',
            aspectRatio: '16:9'
          }
        });

        // Poll for completion
        while (!operation.done) {
          await new Promise(resolve => setTimeout(resolve, 8000));
          operation = await localAi.operations.getVideosOperation({ operation });
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (downloadLink) {
          const videoResp = await fetch(downloadLink, {
            method: 'GET',
            headers: {
              'x-goog-api-key': currentApiKey,
            },
          });
          const blob = await videoResp.blob();
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve) => {
            reader.onloadend = () => {
              const base64String = reader.result as string;
              resolve(base64String.split(',')[1]); // Remove the data:video/mp4;base64, part
            };
          });
          reader.readAsDataURL(blob);
          const videoBase64 = await base64Promise;
          
          return { 
            text: "Neural video synthesis complete. Transmission to visual repository finalized.", 
            toolCalls: [],
            videoBase64 
          };
        }
      } catch (err: any) {
        if (err.message?.includes('Requested entity was not found')) {
          // This usually means the user needs to select a paid key
          throw new Error("VIDEO_API_KEY_REQUIRED");
        }
        throw err;
      }
    }

    const parts: any[] = [{ text: prompt }];
    if (imageBase64) {
      parts.push({ inlineData: { mimeType: "image/jpeg", data: imageBase64 } });
    }

    const sanitizedHistory = history.filter((h, idx) => {
      // Ensure we don't have consecutive identical roles
      if (idx > 0 && h.role === history[idx - 1].role) return false;
      return true;
    });

    // If history ends with 'user', remove it since we add the current prompt as 'user'
    if (sanitizedHistory.length > 0 && sanitizedHistory[sanitizedHistory.length - 1].role === 'user') {
      sanitizedHistory.pop();
    }

    const response = await localAi.models.generateContent({
      model: model,
      contents: [
        ...sanitizedHistory.map(h => ({
          role: h.role === 'model' ? 'model' : 'user',
          parts: h.parts
        })),
        { role: 'user', parts }
      ],
      config: config
    });

    let text = response.text || "";
    const toolCalls = response.functionCalls || [];
    
    let imageOutput = undefined;
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageOutput = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }

    if (!text && !imageOutput && toolCalls.length === 0) {
      text = "Neural Core synthesis completed, but no visual or textual data was transmitted. The system might be processing a complex thought in the background.";
    }

    return { text, toolCalls, imageOutput };
  } catch (error) {
    console.error("Venom Core Error:", error);
    throw error; // Rethrow to handle in App.tsx
  }
};

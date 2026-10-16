/* Model identities and official resources, checked 2026-10-15.
 * Kept separate from generated evaluation data so re-imports preserve links.
 * Icon provenance: assets/model-icons/sources.json.
 */
(function (root, factory) {
  const models = factory();
  if (typeof module === 'object' && module.exports) module.exports = models;
  else root.PROWLeaderboardModels = models;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return {
    "echowm": {
      "icon": "assets/model-icons/echo-monogram.svg",
      "icon_label": "EchoWM monogram",
      "links": [
        {
          "kind": "github",
          "label": "GitHub",
          "url": "https://github.com/jd-opensource/JoyAI-Echo"
        },
        {
          "kind": "project",
          "label": "Project page",
          "url": "https://echo-team-joy-future-academy-jd.github.io/Echo-1.5-Page/wm/"
        },
        {
          "kind": "paper",
          "label": "EchoWM paper",
          "url": "https://arxiv.org/abs/2608.23189"
        },
        {
          "kind": "huggingface",
          "label": "Hugging Face · Echo-WM",
          "url": "https://huggingface.co/Echo-Team/Echo-WM"
        }
      ],
      "sources": [
        "https://arxiv.org/html/2608.23189v1",
        "https://github.com/jd-opensource/JoyAI-Echo"
      ]
    },
    "sana-wm": {
      "icon": "assets/model-icons/nvidia.jpg",
      "icon_label": "NVIDIA",
      "links": [
        {
          "kind": "github",
          "label": "GitHub",
          "url": "https://github.com/NVlabs/Sana"
        },
        {
          "kind": "project",
          "label": "SANA-WM project page",
          "url": "https://nvlabs.github.io/Sana/WM/"
        },
        {
          "kind": "paper",
          "label": "SANA-WM paper",
          "url": "https://arxiv.org/abs/2605.15178"
        },
        {
          "kind": "huggingface",
          "label": "Hugging Face · bidirectional checkpoint",
          "url": "https://huggingface.co/Efficient-Large-Model/SANA-WM_bidirectional"
        }
      ],
      "sources": [
        "https://github.com/NVlabs/Sana/blob/main/docs/sana_wm.md"
      ]
    },
    "lingbot-2.0": {
      "icon": "assets/model-icons/lingbot.png",
      "icon_label": "Robbyant",
      "links": [
        {
          "kind": "github",
          "label": "GitHub · LingBot-World 2.0",
          "url": "https://github.com/Robbyant/lingbot-world-v2"
        },
        {
          "kind": "project",
          "label": "LingBot-World 2.0 project page",
          "url": "https://technology.robbyant.com/lingbot-world-v2"
        },
        {
          "kind": "paper",
          "label": "LingBot-World 2.0 paper",
          "url": "https://arxiv.org/abs/2607.07534"
        },
        {
          "kind": "huggingface",
          "label": "Hugging Face · 14B bidirectional checkpoint",
          "url": "https://huggingface.co/robbyant/lingbot-world-v2-14b-bid"
        }
      ],
      "sources": [
        "https://github.com/Robbyant/lingbot-world-v2"
      ]
    },
    "alayaworld-v1.1": {
      "icon": "assets/model-icons/alaya.png",
      "icon_label": "Alaya Lab",
      "links": [
        {
          "kind": "github",
          "label": "GitHub",
          "url": "https://github.com/AlayaLab/AlayaWorld"
        },
        {
          "kind": "project",
          "label": "Project page",
          "url": "https://alaya-lab.github.io/AlayaWorld/"
        },
        {
          "kind": "paper",
          "label": "AlayaWorld full technical report",
          "url": "https://arxiv.org/abs/2607.18367"
        },
        {
          "kind": "huggingface",
          "label": "Hugging Face · v1.1 Stage3 adapter",
          "url": "https://huggingface.co/AlayaLab/AlayaWorld-v1.1-stage3"
        }
      ],
      "sources": [
        "https://github.com/AlayaLab/AlayaWorld"
      ]
    },
    "cosmos-transfer2.5": {
      "icon": "assets/model-icons/cosmos.png",
      "icon_label": "NVIDIA Cosmos",
      "links": [
        {
          "kind": "github",
          "label": "GitHub",
          "url": "https://github.com/nvidia-cosmos/cosmos-transfer2.5"
        },
        {
          "kind": "project",
          "label": "Cosmos-Transfer2.5 project page",
          "url": "https://research.nvidia.com/labs/cosmos-lab/cosmos-transfer2.5/"
        },
        {
          "kind": "paper",
          "label": "Cosmos paper",
          "url": "https://arxiv.org/abs/2511.00062"
        },
        {
          "kind": "huggingface",
          "label": "Hugging Face · Cosmos-Transfer2.5-2B",
          "url": "https://huggingface.co/nvidia/Cosmos-Transfer2.5-2B"
        }
      ],
      "sources": [
        "https://github.com/nvidia-cosmos/cosmos-transfer2.5"
      ]
    },
    "c2r": {
      "icon": "assets/model-icons/c2r.svg",
      "icon_label": "C2R monogram",
      "links": [
        {
          "kind": "github",
          "label": "GitHub",
          "url": "https://github.com/GonzaloGNogales/coarse2real"
        },
        {
          "kind": "project",
          "label": "Coarse-to-Real project page",
          "url": "https://gonzalognogales.github.io/coarse2real/"
        },
        {
          "kind": "paper",
          "label": "Coarse-to-Real paper",
          "url": "https://arxiv.org/abs/2601.22301"
        },
        {
          "kind": "huggingface",
          "label": "Hugging Face · Coarse-to-Real",
          "url": "https://huggingface.co/gonsaBRK/coarse2real"
        }
      ],
      "sources": [
        "https://gonzalognogales.github.io/coarse2real/"
      ]
    },
    "cwm": {
      "icon": "assets/model-icons/cwm.svg",
      "icon_label": "CWM monogram",
      "links": [
        {
          "kind": "github",
          "label": "GitHub · Code World Model",
          "url": "https://github.com/buaacyw/code-world-model"
        },
        {
          "kind": "project",
          "label": "Code World Model project page",
          "url": "https://buaacyw.github.io/cwm/"
        },
        {
          "kind": "paper",
          "label": "Code World Model paper",
          "url": "https://arxiv.org/abs/2608.25927"
        }
      ],
      "sources": [
        "https://arxiv.org/abs/2608.25927",
        "https://buaacyw.github.io/cwm/"
      ]
    },
    "pwm": {
      "icon": "assets/model-icons/alaya.png",
      "icon_label": "Alaya Lab",
      "links": [
        {
          "kind": "github",
          "label": "GitHub · Programmable World Model",
          "url": "https://github.com/AlayaLab/PWM"
        },
        {
          "kind": "project",
          "label": "Programmable World Model project page",
          "url": "https://alaya-lab.github.io/pwm/"
        },
        {
          "kind": "paper",
          "label": "Programmable World Model paper",
          "url": "https://arxiv.org/abs/2609.10540"
        }
      ],
      "sources": [
        "https://arxiv.org/abs/2609.10540",
        "https://github.com/AlayaLab/PWM"
      ]
    },
    "lynnreal-omni": {
      "icon": "assets/model-icons/lynnreal-monogram.svg",
      "icon_label": "LynnReal monogram",
      "links": [
        {
          "kind": "github",
          "label": "GitHub",
          "url": "https://github.com/LynnReal-AI/LynnReal-Omni"
        },
        {
          "kind": "paper",
          "label": "LynnReal-Omni paper",
          "url": "https://arxiv.org/abs/2609.15863"
        },
        {
          "kind": "huggingface",
          "label": "Hugging Face · standard four-step checkpoints",
          "url": "https://huggingface.co/stdstu123/LynnReal-Onmi-beta-0.1"
        }
      ],
      "sources": [
        "https://github.com/LynnReal-AI/LynnReal-Omni"
      ]
    },
    "minimax-h3": {
      "icon": "assets/model-icons/minimax.jpg",
      "icon_label": "MiniMax",
      "links": [
        {
          "kind": "github",
          "label": "GitHub",
          "url": "https://github.com/MiniMax-AI/MiniMax-H3"
        },
        {
          "kind": "project",
          "label": "Official MiniMax-H3 page",
          "url": "https://hailuoai.video/tools/minimax-h3"
        },
        {
          "kind": "huggingface",
          "label": "Hugging Face · MiniMax-H3",
          "url": "https://huggingface.co/MiniMaxAI/MiniMax-H3"
        }
      ],
      "sources": [
        "https://github.com/MiniMax-AI/MiniMax-H3"
      ]
    },
    "seedance-2.5": {
      "icon": "assets/model-icons/seed.ico",
      "icon_label": "ByteDance Seed",
      "links": [
        {
          "kind": "project",
          "label": "Official Seedance 2.5 page",
          "url": "https://seed.bytedance.com/en/seedance2_5"
        },
        {
          "kind": "article",
          "label": "Seedance 2.5 release announcement",
          "url": "https://seed.bytedance.com/en/blog/one-take-creation-flexible-referencing-introducing-seedance-2-5"
        }
      ],
      "sources": [
        "https://seed.bytedance.com/en/blog/one-take-creation-flexible-referencing-introducing-seedance-2-5"
      ]
    }
  };
});

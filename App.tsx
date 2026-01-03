import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { jsPDF } from 'jspdf';
import { ConnectionState, ChatMessage as ChatMessageType } from './types';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from './services/audioUtils';
import AudioVisualizer from './components/AudioVisualizer';
import ChatMessage from './components/ChatMessage';

// Telegram WebApp type declaration
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
        };
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
        };
      };
    };
  }
}

// --- Static Lesson Content (Enriched with Examples) ---
const STATIC_LESSON_CONTENT = [
  {
    id: 1,
    title: "1-DARS: Salomlashish (Greetings)",
    topic: "Greetings and Introductions",
    words: [
      { term: "Hello", trans: "Salom", desc: "Universal salomlashish so'zi. Har qanday vaziyatda ishlatish mumkin." },
      { term: "Hi", trans: "Salom", desc: "Norasmiy salomlashish. Faqat do'stlar va tengdoshlar bilan ishlatiladi." },
      { term: "Good morning", trans: "Xayrli tong", desc: "Ertalabdan tushgacha (soat 12:00 gacha) ishlatiladi." },
      { term: "Good afternoon", trans: "Xayrli kun", desc: "Tushdan keyin (soat 12:00 dan 17:00 gacha) ishlatiladi." },
      { term: "Good evening", trans: "Xayrli kech", desc: "Kechqurun (soat 17:00 dan keyin) ko'rishganda aytiladi." },
      { term: "My name is...", trans: "Mening ismim...", desc: "O'zingizni tanishtirish uchun ishlatiladi." },
      { term: "Nice to meet you", trans: "Tanishganimdan xursandman", desc: "Birinchi marta ko'rishganda aytiladigan xushmuomala ibora." },
      { term: "How are you?", trans: "Qalaysiz? / Ishlar yaxshimi?", desc: "Hol-ahvol so'rash uchun ishlatiladi." },
      { term: "I am fine", trans: "Men yaxshiman", desc: "'How are you?' savoliga javob." },
      { term: "Thank you", trans: "Rahmat", desc: "Minnatdorchilik bildirishning rasmiy usuli." },
      { term: "You are welcome", trans: "Arzimaydi", desc: "'Thank you' ga javoban aytiladi." },
      { term: "Goodbye", trans: "Xayr", desc: "Rasmiy xayrlashuv so'zi." },
      { term: "See you", trans: "Ko'rishguncha", desc: "Do'stlar bilan xayrlashganda ishlatiladi." }
    ],
    examples: [
      { en: "Hello, my name is Akmal.", uz: "Salom, mening ismim Akmal." },
      { en: "Good morning, teacher!", uz: "Xayrli tong, ustoz!" },
      { en: "How are you? - I am fine, thank you.", uz: "Qalaysiz? - Men yaxshiman, rahmat." },
      { en: "Nice to meet you, goodbye!", uz: "Tanishganimdan xursandman, xayr!" }
    ]
  },
  {
    id: 2,
    title: "2-DARS: Sonlar va Ranglar (Numbers & Colors)",
    topic: "Numbers (1-10) and Basic Colors",
    words: [
      { term: "One", trans: "Bir", desc: "'W' tovushi bilan aytiladi (wan)." },
      { term: "Two", trans: "Ikki", desc: "'T' harfini kuchli nafas bilan ayting." },
      { term: "Three", trans: "Uch", desc: "'Th' tovushi uchun tilni tishlar orasiga qo'yib havo chiqaring." },
      { term: "Four", trans: "To'rt", desc: "'R' harfi deyarli eshitilmaydi (fo:)." },
      { term: "Five", trans: "Besh", desc: "'V' tovushi jarangli bo'lishi kerak." },
      { term: "Six", trans: "Olti", desc: "Oxiridagi 'x' (ks) aniq aytiladi." },
      { term: "Seven", trans: "Yetti", desc: "Ikki bo'g'inli so'z: Se-ven." },
      { term: "Eight", trans: "Sakkiz", desc: "'Gh' harflari o'qilmaydi (eyt)." },
      { term: "Nine", trans: "To'qqiz", desc: "Oxiridagi 'n' aniq aytiladi." },
      { term: "Ten", trans: "O'n", desc: "Qisqa va aniq aytiladi." },
      { term: "Red", trans: "Qizil", desc: "'R' harfi yumshoq talaffuz qilinadi." },
      { term: "Blue", trans: "Ko'k", desc: "Uzun 'u' tovushi bilan (bluu)." },
      { term: "Green", trans: "Yashil", desc: "Cho'ziq 'iy' tovushi (griin)." },
      { term: "Yellow", trans: "Sariq", desc: "'Y' harfi o'zbekcha 'y' kabi." },
      { term: "Black", trans: "Qora", desc: "Keng 'a' tovushi bilan." },
      { term: "White", trans: "Oq", desc: "'H' harfi deyarli o'qilmaydi." }
    ],
    examples: [
      { en: "One red apple.", uz: "Bitta qizil olma." },
      { en: "The sky is blue.", uz: "Osmon ko'k rangda." },
      { en: "I see three green cars.", uz: "Men uchta yashil mashinani ko'ryapman." },
      { en: "My cat is black and white.", uz: "Mening mushugim qora va oq." }
    ]
  },
  {
    id: 3,
    title: "3-DARS: Oila (Family)",
    topic: "Family Members",
    words: [
      { term: "Family", trans: "Oila", desc: "Umumiy oila tushunchasi." },
      { term: "Mother", trans: "Ona", desc: "Rasmiy so'z. Qisqartmasi: Mom." },
      { term: "Father", trans: "Ota", desc: "Rasmiy so'z. Qisqartmasi: Dad." },
      { term: "Sister", trans: "Opa/Singil", desc: "Ingliz tilida opa va singil bir xil ataladi." },
      { term: "Brother", trans: "Aka/Uka", desc: "Ingliz tilida aka va uka bir xil ataladi." },
      { term: "Grandmother", trans: "Buvi", desc: "Qisqartmasi: Grandma." },
      { term: "Grandfather", trans: "Bobo", desc: "Qisqartmasi: Grandpa." },
      { term: "Parents", trans: "Ota-ona", desc: "Ota va onani birgalikda aytganda." },
      { term: "Son", trans: "O'g'il farzand", desc: "Quyosh (Sun) so'zi bilan bir xil o'qiladi." },
      { term: "Daughter", trans: "Qiz farzand", desc: "'Gh' o'qilmaydi (do:ter)." },
      { term: "Baby", trans: "Chaqaloq", desc: "Jinsidan qat'i nazar ishlatiladi." }
    ],
    examples: [
      { en: "This is my mother.", uz: "Bu mening onam." },
      { en: "I love my family.", uz: "Men oilamni yaxshi ko'raman." },
      { en: "My brother is tall.", uz: "Mening akam (ukam) baland bo'yli." },
      { en: "Grandmother and Grandfather are happy.", uz: "Buvim va bobom xursandlar." }
    ]
  },
  {
    id: 4,
    title: "4-DARS: Maktab (School)",
    topic: "School Items and Places",
    words: [
      { term: "School", trans: "Maktab", desc: "Bolalar o'qiydigan joy." },
      { term: "Teacher", trans: "O'qituvchi", desc: "Dars beradigan shaxs. Rasmiy so'z." },
      { term: "Student", trans: "O'quvchi", desc: "Maktabda o'qiydigan bola." },
      { term: "Classroom", trans: "Sinf xonasi", desc: "Dars o'tiladigan xona." },
      { term: "Book", trans: "Kitob", desc: "O'qish uchun ishlatiladigan narsa." },
      { term: "Pen", trans: "Ruchka", desc: "Yozish uchun ishlatiladigan vosita." },
      { term: "Pencil", trans: "Qalam", desc: "Yozish va chizish uchun." },
      { term: "Notebook", trans: "Daftar", desc: "Yozuv daftari." },
      { term: "Desk", trans: "Parta", desc: "O'quvchilar o'tiradigan stol." },
      { term: "Board", trans: "Doska", desc: "O'qituvchi yozadigan doska. Blackboard yoki Whiteboard." },
      { term: "Homework", trans: "Uy vazifasi", desc: "Uyda bajariladigan topshiriq." },
      { term: "Lesson", trans: "Dars", desc: "Bir mavzu bo'yicha o'tiladigan mashg'ulot." }
    ],
    examples: [
      { en: "I go to school every day.", uz: "Men har kuni maktabga boraman." },
      { en: "The teacher is in the classroom.", uz: "O'qituvchi sinf xonasida." },
      { en: "Open your book, please.", uz: "Iltimos, kitobingizni oching." },
      { en: "I write with a pen.", uz: "Men ruchka bilan yozaman." },
      { en: "Did you do your homework?", uz: "Uy vazifangizni bajardingizmi?" }
    ]
  },
  {
    id: 5,
    title: "5-DARS: Ovqatlar (Food)",
    topic: "Food and Drinks",
    words: [
      { term: "Food", trans: "Ovqat/Taom", desc: "Umumiy ovqat tushunchasi." },
      { term: "Water", trans: "Suv", desc: "Ichimlik. 'W' harfi bilan boshlanadi." },
      { term: "Bread", trans: "Non", desc: "Asosiy oziq-ovqat mahsuloti." },
      { term: "Rice", trans: "Guruch/Palov", desc: "O'zbek oshining asosi." },
      { term: "Meat", trans: "Go'sht", desc: "Oqsilga boy oziq-ovqat." },
      { term: "Chicken", trans: "Tovuq", desc: "Tovuq go'shti." },
      { term: "Fish", trans: "Baliq", desc: "Suvda yashovchi hayvon go'shti." },
      { term: "Egg", trans: "Tuxum", desc: "Tovuq tuxumi." },
      { term: "Milk", trans: "Sut", desc: "Oq rang ichimlik, sigirdan olinadi." },
      { term: "Tea", trans: "Choy", desc: "Issiq ichimlik. O'zbeklar ko'p ichadi." },
      { term: "Juice", trans: "Sharbat", desc: "Mevalardan tayyorlangan ichimlik." },
      { term: "Apple", trans: "Olma", desc: "Qizil yoki yashil meva." },
      { term: "Banana", trans: "Banan", desc: "Sariq tropik meva." },
      { term: "Vegetable", trans: "Sabzavot", desc: "O'simlik oziq-ovqatlari." }
    ],
    examples: [
      { en: "I drink water every day.", uz: "Men har kuni suv ichaman." },
      { en: "Bread and tea for breakfast.", uz: "Nonushta uchun non va choy." },
      { en: "I like chicken and rice.", uz: "Men tovuq va guruchni yoqtiraman." },
      { en: "Would you like some juice?", uz: "Sharbat ichasizmi?" },
      { en: "Vegetables are healthy.", uz: "Sabzavotlar foydali." }
    ]
  },
  {
    id: 6,
    title: "6-DARS: Hayvonlar (Animals)",
    topic: "Domestic and Wild Animals",
    words: [
      { term: "Animal", trans: "Hayvon", desc: "Umumiy hayvon tushunchasi." },
      { term: "Dog", trans: "It", desc: "Eng sodiq uy hayvoni." },
      { term: "Cat", trans: "Mushuk", desc: "Kichik uy hayvoni, miyovlaydi." },
      { term: "Bird", trans: "Qush", desc: "Uchuvchi hayvon." },
      { term: "Cow", trans: "Sigir", desc: "Sut beradigan yirik hayvon." },
      { term: "Horse", trans: "Ot", desc: "Minib yuriladigan hayvon." },
      { term: "Sheep", trans: "Qo'y", desc: "Jun va go'sht uchun boqiladi." },
      { term: "Chicken", trans: "Tovuq", desc: "Tuxum beradigan parrandalar." },
      { term: "Fish", trans: "Baliq", desc: "Suvda yashaydigan hayvon." },
      { term: "Lion", trans: "Sher", desc: "Hayvonlar shohi, yirtqich." },
      { term: "Elephant", trans: "Fil", desc: "Eng katta quruqlik hayvoni." },
      { term: "Monkey", trans: "Maymun", desc: "Daraxtlarda yashovchi hayvon." },
      { term: "Snake", trans: "Ilon", desc: "Oyoqsiz sudralib yuruvchi." },
      { term: "Rabbit", trans: "Quyon", desc: "Uzun quloqli kichik hayvon." }
    ],
    examples: [
      { en: "I have a dog.", uz: "Mening itim bor." },
      { en: "The cat is sleeping.", uz: "Mushuk uxlayapti." },
      { en: "Birds can fly.", uz: "Qushlar ucha oladi." },
      { en: "The lion is the king of animals.", uz: "Sher hayvonlar shohi." },
      { en: "Elephants are very big.", uz: "Fillar juda katta." }
    ]
  },
  {
    id: 7,
    title: "7-DARS: Kiyimlar (Clothes)",
    topic: "Clothing and Accessories",
    words: [
      { term: "Clothes", trans: "Kiyim-kechak", desc: "Umumiy kiyim tushunchasi." },
      { term: "Shirt", trans: "Ko'ylak", desc: "Erkaklar kiyimi, tugmali." },
      { term: "T-shirt", trans: "Futbolka", desc: "Yengil sport kiyimi." },
      { term: "Pants", trans: "Shim", desc: "Oyoqqa kiyiladigan kiyim. Trousers ham deyiladi." },
      { term: "Dress", trans: "Ko'ylak (ayollar)", desc: "Ayollar va qizlar kiyimi." },
      { term: "Jacket", trans: "Kurtka", desc: "Sovuqda kiyiladigan ustki kiyim." },
      { term: "Coat", trans: "Palto", desc: "Qishki ustki kiyim." },
      { term: "Shoes", trans: "Poyabzal/Tufli", desc: "Oyoqqa kiyiladi." },
      { term: "Socks", trans: "Paypoq", desc: "Oyoqqa, poyabzal ichiga kiyiladi." },
      { term: "Hat", trans: "Shapka/Qalpoq", desc: "Boshga kiyiladi." },
      { term: "Scarf", trans: "Sharf/Ro'mol", desc: "Bo'yinga o'raladi." },
      { term: "Gloves", trans: "Qo'lqop", desc: "Qo'llarga kiyiladi, sovuqdan himoya." }
    ],
    examples: [
      { en: "I wear a shirt to school.", uz: "Men maktabga ko'ylak kiyaman." },
      { en: "Put on your jacket, it's cold.", uz: "Kurtkangni kiy, sovuq." },
      { en: "These shoes are new.", uz: "Bu poyabzallar yangi." },
      { en: "She is wearing a beautiful dress.", uz: "U chiroyli ko'ylak kiygan." },
      { en: "Don't forget your hat!", uz: "Shapkangni unutma!" }
    ]
  },
  {
    id: 8,
    title: "8-DARS: Uy va Mebel (Home & Furniture)",
    topic: "Home, Rooms and Furniture",
    words: [
      { term: "House", trans: "Uy", desc: "Yashash joyi." },
      { term: "Room", trans: "Xona", desc: "Uyning bir qismi." },
      { term: "Kitchen", trans: "Oshxona", desc: "Ovqat pishiriladigan xona." },
      { term: "Bedroom", trans: "Yotoq xonasi", desc: "Uxlaydigan xona." },
      { term: "Bathroom", trans: "Hammom", desc: "Yuvinish xonasi." },
      { term: "Living room", trans: "Mehmonxona", desc: "Oila yig'iladigan katta xona." },
      { term: "Door", trans: "Eshik", desc: "Xonaga kirish joyi." },
      { term: "Window", trans: "Deraza", desc: "Yorug'lik kiradigan joy." },
      { term: "Table", trans: "Stol", desc: "Ovqat yeyiladigan mebel." },
      { term: "Chair", trans: "Stul", desc: "O'tiradigan mebel." },
      { term: "Bed", trans: "Karavot/To'shak", desc: "Uxlaydigan mebel." },
      { term: "Sofa", trans: "Divan", desc: "Yumshoq o'rindiq, ko'p kishilik." }
    ],
    examples: [
      { en: "Welcome to my house!", uz: "Mening uyimga xush kelibsiz!" },
      { en: "The kitchen is clean.", uz: "Oshxona toza." },
      { en: "I sleep in my bedroom.", uz: "Men yotoq xonamda uxlayman." },
      { en: "Please, sit on the chair.", uz: "Iltimos, stulga o'tiring." },
      { en: "Open the window, please.", uz: "Iltimos, derazani oching." }
    ]
  },
  {
    id: 9,
    title: "9-DARS: Kasb-hunarlar (Jobs)",
    topic: "Professions and Occupations",
    words: [
      { term: "Job", trans: "Ish/Kasb", desc: "Umumiy kasb tushunchasi. Work ham deyiladi." },
      { term: "Doctor", trans: "Shifokor", desc: "Bemorlarni davolovchi mutaxassis." },
      { term: "Nurse", trans: "Hamshira", desc: "Shifokorga yordam beruvchi." },
      { term: "Teacher", trans: "O'qituvchi", desc: "Maktabda dars beruvchi." },
      { term: "Engineer", trans: "Muhandis", desc: "Texnik mutaxassis." },
      { term: "Driver", trans: "Haydovchi", desc: "Transport haydovchisi." },
      { term: "Police officer", trans: "Politsiyachi", desc: "Tartibni saqlaydi." },
      { term: "Firefighter", trans: "O't o'chiruvchi", desc: "Yong'inlarni o'chiradi." },
      { term: "Cook", trans: "Oshpaz", desc: "Ovqat pishiradigan mutaxassis. Chef ham deyiladi." },
      { term: "Farmer", trans: "Fermer/Dehqon", desc: "Qishloq xo'jaligida ishlovchi." },
      { term: "Pilot", trans: "Uchuvchi", desc: "Samolyot boshqaruvchisi." },
      { term: "Builder", trans: "Quriluvchi", desc: "Uylar quradigan ishchi." }
    ],
    examples: [
      { en: "My father is a doctor.", uz: "Mening otam shifokor." },
      { en: "I want to be a pilot.", uz: "Men uchuvchi bo'lishni xohlayman." },
      { en: "The teacher is very kind.", uz: "O'qituvchi juda mehribon." },
      { en: "Police officers help people.", uz: "Politsiyachilar odamlarga yordam beradi." },
      { en: "What is your job?", uz: "Sizning kasbingiz nima?" }
    ]
  },
  {
    id: 10,
    title: "10-DARS: Vaqt va Kunlar (Time & Days)",
    topic: "Days of the Week and Time",
    words: [
      { term: "Time", trans: "Vaqt", desc: "Umumiy vaqt tushunchasi." },
      { term: "Day", trans: "Kun", desc: "24 soatlik davr." },
      { term: "Week", trans: "Hafta", desc: "7 kunlik davr." },
      { term: "Monday", trans: "Dushanba", desc: "Haftaning birinchi kuni." },
      { term: "Tuesday", trans: "Seshanba", desc: "Haftaning ikkinchi kuni." },
      { term: "Wednesday", trans: "Chorshanba", desc: "Haftaning uchinchi kuni." },
      { term: "Thursday", trans: "Payshanba", desc: "Haftaning to'rtinchi kuni." },
      { term: "Friday", trans: "Juma", desc: "Haftaning beshinchi kuni." },
      { term: "Saturday", trans: "Shanba", desc: "Dam olish kuni boshlanishi." },
      { term: "Sunday", trans: "Yakshanba", desc: "Haftaning oxirgi kuni." },
      { term: "Today", trans: "Bugun", desc: "Hozirgi kun." },
      { term: "Tomorrow", trans: "Ertaga", desc: "Keyingi kun." },
      { term: "Yesterday", trans: "Kecha", desc: "O'tgan kun." },
      { term: "Hour", trans: "Soat", desc: "60 daqiqalik vaqt birligi." }
    ],
    examples: [
      { en: "What time is it?", uz: "Soat necha?" },
      { en: "Today is Monday.", uz: "Bugun dushanba." },
      { en: "I go to school from Monday to Friday.", uz: "Men dushanbadan jumagacha maktabga boraman." },
      { en: "Saturday and Sunday are weekends.", uz: "Shanba va yakshanba dam olish kunlari." },
      { en: "See you tomorrow!", uz: "Ertagacha ko'rishguncha!" }
    ]
  }
];

// System instruction updated to strictly follow the 10+ words rule AND use UZBEK instructions
const SYSTEM_INSTRUCTION = `
Role:
You are "TrendoSpeak," a HIGHLY PROFESSIONAL and PATIENT English tutor for Uzbek beginners.
Your goal is to teach English step-by-step.

**CRITICAL RULE:**
Every lesson MUST teach **at least 10-12 words**. Do NOT stop after 3-4 words.
You must cover the full vocabulary list for the selected lesson.

**LANGUAGE PROTOCOL (STRICT):**
1.  **Instructional Phrases MUST be in UZBEK.**
    *   **INCORRECT:** "Number 1", "Repeat after me", "Next word".
    *   **CORRECT:** "1-so'z", "Mening ortimdan qaytaring", "Keyingi so'z".
2.  **Target Word:** Only the word being taught should be in English.

**Teaching Style:**
1.  **Explanations in Uzbek:** Always explain the meaning and usage in Uzbek.
2.  **Target in English:** Pronounce the English word clearly.
3.  **Correction:** Correct pronunciation mistakes gently in Uzbek.
4.  **Audio Length:** Keep responses short (under 10-15 seconds) so the user doesn't get bored.

**Lesson Structure:**
1.  **Introduction:** Briefly state the topic (e.g., "Bugun sonlar va ranglarni o'rganamiz").
2.  **Vocabulary Loop (Repeat for 10+ words):**
    *   **Format:** "[N]-so'z. [English Word] - [Uzbek Word]. [Short Explanation in Uzbek]. Mening ortimdan qaytaring: [English Word]"
    *   **Example:** "1-so'z. Apple - Olma. Bu meva. Mening ortimdan qaytaring: Apple"
    *   Wait for user input.
    *   Give feedback ("Barakalla", "Yaxshi", "Yana bir bor urinib ko'ring").
    *   Move to the next word immediately.
3.  **Practice:** After all words are done, do a quick roleplay or quiz in Uzbek/English mix.

**Specific Lesson Guidelines:**
*   **Lesson 1 (Greetings):** Cover Hello, Hi, Good morning/afternoon/evening, Names, Nice to meet you, How are you, I am fine, Thank you, Goodbye, See you. (Total 10+ words).
*   **Lesson 2 (Numbers & Colors):** Cover Numbers 1-10 AND Colors (Red, Blue, Green, Yellow, Black, White). (Total 16 words).
*   **Lesson 3 (Family):** Cover Family, Parents, Mother, Father, Sister, Brother, Grandma, Grandpa, Son, Daughter. (Total 10+ words).
*   **Lesson 4 (School):** Cover School, Teacher, Student, Classroom, Book, Pen, Pencil, Notebook, Desk, Board, Homework, Lesson. (Total 12 words).
*   **Lesson 5 (Food):** Cover Food, Water, Bread, Rice, Meat, Chicken, Fish, Egg, Milk, Tea, Juice, Apple, Banana, Vegetable. (Total 14 words).
*   **Lesson 6 (Animals):** Cover Animal, Dog, Cat, Bird, Cow, Horse, Sheep, Chicken, Fish, Lion, Elephant, Monkey, Snake, Rabbit. (Total 14 words).
*   **Lesson 7 (Clothes):** Cover Clothes, Shirt, T-shirt, Pants, Dress, Jacket, Coat, Shoes, Socks, Hat, Scarf, Gloves. (Total 12 words).
*   **Lesson 8 (Home):** Cover House, Room, Kitchen, Bedroom, Bathroom, Living room, Door, Window, Table, Chair, Bed, Sofa. (Total 12 words).
*   **Lesson 9 (Jobs):** Cover Job, Doctor, Nurse, Teacher, Engineer, Driver, Police officer, Firefighter, Cook, Farmer, Pilot, Builder. (Total 12 words).
*   **Lesson 10 (Time & Days):** Cover Time, Day, Week, Monday-Sunday, Today, Tomorrow, Yesterday, Hour. (Total 14 words).

**Interaction:**
If the user says "Start Lesson 5", ignore previous context and start Lesson 5 vocabulary immediately using the UZBEK instructional phrases.
`;

const App: React.FC = () => {
  // --- State ---
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Subscription state
  const [hasSubscription, setHasSubscription] = useState<boolean>(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState<boolean>(true);
  const [telegramUserId, setTelegramUserId] = useState<number | null>(null);

  // --- Refs for Audio & API ---
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Ref for activeLessonId to ensure callbacks always see the current value
  const activeLessonIdRef = useRef<number | null>(null);

  useEffect(() => {
    activeLessonIdRef.current = activeLessonId;
  }, [activeLessonId]);

  // --- Telegram Mini App Initialization & Subscription Check ---
  useEffect(() => {
    const initTelegram = async () => {
      if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();

        // Get user ID from Telegram WebApp
        const initDataUnsafe = (tg as any).initDataUnsafe;
        if (initDataUnsafe?.user?.id) {
          const userId = initDataUnsafe.user.id;
          setTelegramUserId(userId);

          // Check subscription status from bot API
          try {
            const BOT_API_URL = import.meta.env.VITE_BOT_API_URL || '';
            if (BOT_API_URL) {
              const response = await fetch(`${BOT_API_URL}/api/subscription/${userId}`);
              if (response.ok) {
                const data = await response.json();
                setHasSubscription(data.has_subscription || false);
              }
            }
          } catch (error) {
            console.log('Subscription check failed, defaulting to free tier');
          }
        }
      }
      setSubscriptionLoading(false);
    };

    initTelegram();
  }, []);

  // --- Auto-scroll to bottom ---
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // --- TXT Download Function (Individual Lesson) ---
  const handleDownloadLessonTXT = (e: React.MouseEvent, lesson: typeof STATIC_LESSON_CONTENT[0]) => {
    e.stopPropagation(); // Prevent selecting the lesson when clicking download

    // Build text content
    let content = '';
    content += '═══════════════════════════════════════════════════════════════\n';
    content += `           TrendoSpeak: ${lesson.title}\n`;
    content += '═══════════════════════════════════════════════════════════════\n';
    content += `Mavzu: ${lesson.topic}\n`;
    content += `Sana: ${new Date().toLocaleDateString()}\n`;
    content += '\n';
    content += '───────────────────────────────────────────────────────────────\n';
    content += "                    YANGI SO'ZLAR (VOCABULARY)\n";
    content += '───────────────────────────────────────────────────────────────\n\n';

    lesson.words.forEach((item, index) => {
      content += `${index + 1}. ${item.term} - ${item.trans}\n`;
      content += `   📝 ${item.desc}\n\n`;
    });

    content += '───────────────────────────────────────────────────────────────\n';
    content += '                    FOYDALI MISOLLAR (EXAMPLES)\n';
    content += '───────────────────────────────────────────────────────────────\n\n';

    if (lesson.examples && lesson.examples.length > 0) {
      lesson.examples.forEach((ex, idx) => {
        content += `${idx + 1}. 🇬🇧 ${ex.en}\n`;
        content += `   🇺🇿 ${ex.uz}\n\n`;
      });
    } else {
      content += 'Misollar mavjud emas.\n';
    }

    content += '\n═══════════════════════════════════════════════════════════════\n';
    content += '                 TrendoSpeak AI maxsus darsligi\n';
    content += '═══════════════════════════════════════════════════════════════\n';

    // Create and download TXT file using data URL (works better on localhost)
    const fileName = `TrendoSpeak_Dars_${lesson.id}.txt`;
    const dataUrl = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Lesson Switch Logic ---
  const handleSelectLesson = async (lessonId: number) => {
    setActiveLessonId(lessonId);
    setIsSidebarOpen(false); // Close sidebar on mobile selection

    const lesson = STATIC_LESSON_CONTENT.find(l => l.id === lessonId);
    if (!lesson) return;

    if (connectionState === ConnectionState.CONNECTED && sessionPromiseRef.current) {
      // Send text prompt to switch context
      const prompt = `TEACHER: STOP previous lesson. START ${lesson.title} NOW. Topic: ${lesson.topic}. Start teaching word #1 immediately. USE UZBEK FOR INSTRUCTIONS (e.g., "1-so'z", "Mening ortimdan qaytaring").`;

      addMessage('user', `Start ${lesson.title}`, true); // Visual feedback

      const session = await sessionPromiseRef.current;
      session.sendRealtimeInput({
        mimeType: 'text/plain',
        data: prompt
      });
    }
    // If disconnected, user will click Start, and handleConnect will use the Ref
  };

  // --- Helpers ---
  const addMessage = (role: 'user' | 'model', text: string, isFinal: boolean = true) => {
    setMessages(prev => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg && lastMsg.role === role && !lastMsg.isFinal) {
        return [...prev.slice(0, -1), { ...lastMsg, text: lastMsg.text + text, isFinal }];
      }
      return [...prev, { id: Date.now().toString(), role, text, isFinal }];
    });
  };

  const cleanupAudio = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) { }
    });
    sourcesRef.current.clear();

    if (inputAudioContextRef.current) { inputAudioContextRef.current.close(); inputAudioContextRef.current = null; }
    if (outputAudioContextRef.current) { outputAudioContextRef.current.close(); outputAudioContextRef.current = null; }

    inputAnalyserRef.current = null;
    outputAnalyserRef.current = null;
    sessionPromiseRef.current = null;
    nextStartTimeRef.current = 0;
  }, []);

  const handleDisconnect = useCallback(() => {
    cleanupAudio();
    setConnectionState(ConnectionState.DISCONNECTED);
  }, [cleanupAudio]);

  const handleConnect = async () => {
    if (!process.env.API_KEY) {
      setErrorMessage("API Key not found in environment variables.");
      return;
    }

    try {
      setErrorMessage(null);
      setConnectionState(ConnectionState.CONNECTING);

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      const inAnalyser = inputCtx.createAnalyser(); inAnalyser.fftSize = 64; inputAnalyserRef.current = inAnalyser;
      const outAnalyser = outputCtx.createAnalyser(); outAnalyser.fftSize = 64; outputAnalyserRef.current = outAnalyser;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          systemInstruction: SYSTEM_INSTRUCTION,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log("Connection Established");
            setConnectionState(ConnectionState.CONNECTED);

            const source = inputCtx.createMediaStreamSource(stream);
            source.connect(inAnalyser);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = processor;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then(session => session.sendRealtimeInput({ media: pcmBlob }));
              }
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);

            // USE REF TO GET LATEST LESSON ID REGARDLESS OF CLOSURE
            const currentLessonId = activeLessonIdRef.current;
            const selectedLesson = STATIC_LESSON_CONTENT.find(l => l.id === currentLessonId);

            let startPrompt = "Start the lesson. Introduce yourself briefly and start with Lesson 1 Word 1 immediately.";

            if (currentLessonId && selectedLesson) {
              startPrompt = `TEACHER: The user selected ${selectedLesson.title}. Topic: ${selectedLesson.topic}. START ${selectedLesson.title} IMMEDIATELY. Ignore previous context. Begin teaching Word #1 now. USE UZBEK FOR INSTRUCTIONS (e.g., "1-so'z", "Mening ortimdan qaytaring").`;
            }

            sessionPromiseRef.current?.then(session => {
              session.sendRealtimeInput({ mimeType: 'text/plain', data: startPrompt });
            });
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.turnComplete && msg.serverContent?.inputTranscription) {
              addMessage('user', msg.serverContent.inputTranscription.text);
            }
            if (msg.serverContent?.outputTranscription) {
              addMessage('model', msg.serverContent.outputTranscription.text, false);
            }
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              const ctx = outputAudioContextRef.current;
              if (!ctx) return;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBuffer = await decodeAudioData(base64ToUint8Array(audioData), ctx, 24000);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outAnalyser);
              outAnalyser.connect(ctx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }
            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => { handleDisconnect(); },
          onerror: (err) => { handleDisconnect(); }
        }
      });
      sessionPromiseRef.current = sessionPromise;

    } catch (err: any) {
      handleDisconnect();
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 relative overflow-hidden">

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-72 bg-white border-r border-gray-200 flex-col z-20 shadow-md">
        <div className="p-6 border-b border-gray-100 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">T</div>
          <h1 className="text-xl font-bold text-slate-800">TrendoSpeak</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 ml-2">Darslar (Curriculum)</h2>
          {!hasSubscription && !subscriptionLoading && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
              <p className="text-xs text-amber-700">🔒 Faqat 1-dars bepul. Barcha darslar uchun Premium obuna oling!</p>
            </div>
          )}
          {STATIC_LESSON_CONTENT.map((lesson) => {
            const isLocked = !hasSubscription && lesson.id > 1;
            return (
              <div key={lesson.id} className={`flex gap-2 w-full ${isLocked ? 'opacity-60' : ''}`}>
                <button
                  onClick={() => !isLocked && handleSelectLesson(lesson.id)}
                  disabled={isLocked}
                  className={`flex-1 text-left p-3 rounded-lg text-sm font-medium transition-all ${activeLessonId === lesson.id
                    ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-sm'
                    : isLocked
                      ? 'text-gray-400 bg-gray-50 cursor-not-allowed'
                      : 'text-gray-600 hover:bg-gray-50'
                    }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="truncate">{isLocked ? '🔒 ' : ''}{lesson.title}</span>
                    {activeLessonId === lesson.id && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0"></div>}
                  </div>
                </button>
                <button
                  onClick={(e) => !isLocked && handleDownloadLessonTXT(e, lesson)}
                  disabled={isLocked}
                  className={`p-3 rounded-lg transition-colors border border-transparent ${isLocked
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    : 'bg-gray-50 hover:bg-blue-100 text-gray-500 hover:text-blue-600 hover:border-blue-200'
                    }`}
                  title={isLocked ? "Premium kerak" : "TXT Yuklash"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
        <div className="p-4 border-t border-gray-100 text-xs text-gray-400 text-center">
          Select a lesson to start or download TXT
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative">

        {/* Mobile Header with Sidebar Toggle */}
        <header className="md:hidden px-4 py-3 bg-white border-b border-gray-200 flex justify-between items-center z-30">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="font-bold text-slate-800">TrendoSpeak</span>
          </div>
          <div className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-600 rounded">AI Tutor</div>
        </header>

        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div className="absolute inset-0 z-50 bg-gray-900/50 md:hidden" onClick={() => setIsSidebarOpen(false)}>
            <div className="w-72 h-full bg-white shadow-xl p-4 overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h2 className="font-bold text-lg">Darslar</h2>
                <button onClick={() => setIsSidebarOpen(false)} className="text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-3">
                {STATIC_LESSON_CONTENT.map((lesson) => (
                  <div key={lesson.id} className="flex gap-2">
                    <button
                      onClick={() => handleSelectLesson(lesson.id)}
                      className={`flex-1 text-left p-3 rounded-lg text-sm font-medium ${activeLessonId === lesson.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 bg-gray-50'
                        }`}
                    >
                      {lesson.title}
                    </button>
                    <button
                      onClick={(e) => handleDownloadLessonTXT(e, lesson)}
                      className="p-3 bg-gray-100 text-gray-600 rounded-lg"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Top Bar (Desktop) */}
        <header className="hidden md:flex px-6 py-4 justify-between items-center bg-white/50 backdrop-blur-sm border-b border-gray-100">
          <div className="flex items-center gap-2">
            {activeLessonId && (
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase tracking-wide">
                Active: Lesson {activeLessonId}
              </span>
            )}
          </div>
          <div className="text-xs font-medium text-gray-400">Powered by Gemini 2.0 Flash</div>
        </header>

        {/* Visualizer Area */}
        <div className="flex-shrink-0 h-48 bg-gradient-to-b from-blue-50/50 to-transparent flex flex-col items-center justify-center relative border-b border-gray-100">
          {connectionState === ConnectionState.CONNECTED ? (
            <div className="relative w-full max-w-xs h-32 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center">
                <AudioVisualizer
                  analyser={outputAnalyserRef.current}
                  isActive={true}
                  color="#2563EB"
                />
              </div>
              <div className="absolute bottom-0 text-xs text-blue-500 font-medium animate-pulse">
                Teacher is active
              </div>
            </div>
          ) : (
            <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center shadow-inner text-4xl border border-slate-200">
              🤖
            </div>
          )}

          <div className="mt-3 text-center min-h-[24px]">
            {connectionState === ConnectionState.DISCONNECTED && (
              <p className="text-slate-500 text-sm">Select a lesson & press Start</p>
            )}
            {connectionState === ConnectionState.CONNECTING && (
              <p className="text-blue-600 animate-pulse text-sm font-medium">Connecting...</p>
            )}
            {errorMessage && (
              <p className="text-red-500 text-xs px-4">{errorMessage}</p>
            )}
          </div>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hide space-y-4 w-full max-w-3xl mx-auto">
          {messages.length === 0 && connectionState === ConnectionState.CONNECTED && (
            <div className="text-center text-gray-400 text-sm mt-10 p-6 bg-slate-50 rounded-xl border border-slate-100 mx-auto max-w-md">
              <p className="font-semibold text-gray-600 mb-2">Welcome!</p>
              <p>I am listening. Just say "Hello" or select a lesson from the sidebar.</p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <ChatMessage key={idx} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Control Bar */}
        <footer className="p-4 bg-white border-t border-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)] z-20">
          <div className="max-w-md mx-auto flex justify-center w-full">
            {connectionState === ConnectionState.DISCONNECTED || connectionState === ConnectionState.ERROR ? (
              <button
                onClick={handleConnect}
                className="w-full md:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold shadow-lg shadow-blue-200 transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                </svg>
                {activeLessonId ? `Start Lesson ${activeLessonId}` : 'Start / Boshlash'}
              </button>
            ) : (
              <button
                onClick={handleDisconnect}
                className="w-full md:w-auto px-8 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-bold shadow-lg shadow-red-200 transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Stop / To'xtatish
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
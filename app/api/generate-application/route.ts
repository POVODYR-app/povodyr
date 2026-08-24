import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { opportunityTitle, opportunityDescription, artistProfile } = await req.json();

    if (!opportunityTitle) {
      return NextResponse.json({ success: false, error: 'Не вказано назву можливості' }, { status: 400 });
    }

    const prompt = `
 Ти — професійний арт-менеджер та куратор, який допомагає художниці Ванді Орловій створювати заявки на міжнародні та українські виставки, гранти й опеноколи.
 Твоє завдання — згенерувати пакет документів для подачі на можливість.

 ІНФОРМАЦІЯ ПРО ХУДОЖНИЦЮ:
 - Ім'я: ${artistProfile?.name || 'Ванда Орлова'}
 - Стиль та авторська техніка: ${JSON.stringify(artistProfile?.artistic_styles || ['Солярісм', 'Сучасний станковий живопис'])}
 - Техніки та матеріали: ${JSON.stringify(artistProfile?.techniques || ['Олія на полотні', 'Мультишаровий акриловий живопис', 'Золота поталь'])}
 - Тематика: ${JSON.stringify(artistProfile?.themes || ['Українська культурна спадщина', 'Флористика та ботанічні мотиви'])}
 - Серії робіт: ${JSON.stringify(artistProfile?.series || ['Квіткова спадщина', 'Трояндовий рай', 'Код Мазепи'])}
 - Рівень: ${artistProfile?.professional_level || 'Professional / Established'}
 - Обрані виставки та нагороди: Виставка «КОД МАЗЕПИ» (Музей Гетьманства, 2026), виставка «Мозаїка спадщини України» (Living Room, 2026), Диплом ІІІ ступеня у номінації «Книжкова графіка» (ХІІІ Всеукраїнська виставка-конкурс ім. Г. Якутовича, 2026).

 ІНФОРМАЦІЯ ПРО МОЖЛИВІСТЬ:
 - Назва: ${opportunityTitle}
 - Опис: ${opportunityDescription || 'Не вказано детального опису'}

 КРИТИЧНЕ ПРАВИЛО: 
 Заборонено вигадувати біографічні факти, виставки, нагороди, техніки чи серії, яких немає в цьому промпті. Використовуй виключно надані дані. Якщо для якогось поля недостатньо інформації, маркуй його як [потрібна інформація].

 Згенеруй наступні документи українською мовою (з можливістю перекладу на англійську за потреби):
 1. Motivation Letter (Мотиваційний лист)
 2. Artist Statement (Заява художника про творчий підхід до світла, солярізму та спадщини)
 3. Project Description (Короткий опис проєкту на основі серій робіт)
 4. Рекомендований перелік робіт для подачі.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const resultText = response.text || 'Не вдалося згенерувати документ.';

    return NextResponse.json({ success: true, applicationData: resultText });
  } catch (error: any) {
    console.error('Помилка генерації заявки:', error);
    return NextResponse.json({ success: false, error: error.message || 'Помилка серверну' }, { status: 500 });
  }
}

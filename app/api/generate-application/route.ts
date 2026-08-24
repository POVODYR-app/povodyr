import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { opportunityTitle, opportunityDescription, artistProfile } = await req.json();

    if (!opportunityTitle) {
      return NextResponse.json({ success: false, error: 'Не вказано назву можливості' }, { status: 400 });
    }

    const prompt = `
Твоє завдання — згенерувати професійний пакет документів для подачі на можливість.

ІНФОРМАЦІЯ ПРО ХУДОЖНИЦЮ:
- Ім'я: Ванда Орлова
- Стиль та авторська техніка: Солярісм, Графічна ілюстрація
- Техніки та матеріали: Олія на полотні, Мультишаровий акриловий живопис, Золота поталь, Цифрова графічна ілюстрація
- Тематика: Українська культурна спадщина, Пейзажі, Інтер'єрний живопис
- Серії робіт: Голос Березового гаю, Світанки, Про любов
- Рівень: Professional / Established
- Обрані виставки та нагороди: Виставка «КОД МАЗЕПИ» (Музей Гетьманства, 2026), виставка «Мозаїка культурної спадщини України» (Музей Марії Заньковецької, 2025), Диплом ІІІ ступеня у номінації «Книжкова графіка» (ХІІІ Всеукраїнська виставка-конкурс ім. Г. Якутовича, 2026).

ІНФОРМАЦІЯ ПРО МОЖЛИВІСТЬ:
- Назва: ${opportunityTitle}
- Опис: ${opportunityDescription || 'Не вказано детального опису'}

Згенеруй наступні документи українською мовою:
1. Motivation Letter (Мотиваційний лист)
2. Artist Statement (Заява художника про творчий підхід до світла та спадщини)
3. Project Description (Короткий опис проєкту)
4. Рекомендований перелік робіт для подачі.
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // або 'gpt-4o'
      messages: [
        { role: 'system', content: 'Ти — професійний арт-менеджер та куратор.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
    });

    const resultText = completion.choices[0]?.message?.content || 'Не вдалося згенерувати документ.';

    return NextResponse.json({ success: true, text: resultText });
  } catch (error: any) {
    console.error('Помилка генерації заявки:', error);
    return NextResponse.json({ success: false, error: error.message || 'Помилка сервера' }, { status: 500 });
  }
}

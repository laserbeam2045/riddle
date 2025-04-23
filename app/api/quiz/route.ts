import { NextResponse } from "next/server";

// クイズデータ型定義
interface Question {
  question: string;
  imageUrl?: string;
  answers: string[];
  hint?: string;
  explanation?: string;
}

interface QuizData {
  [key: number]: Question[];
}

// クイズデータ（元のpage.tsxから移植）
const quizData: QuizData = {
  1: [
    {
      question: "「イ なら ウ」\n\nこれの逆は？",
      answers: ["占い", "うらない"],
      hint: "つなげて逆から読んでみよう",
      explanation: "つなげて逆から読むと「うらない」になります。",
    },
    {
      question: "さわると〇〇虫ってな～んだ？",
      answers: ["ダンゴムシ", "ダンゴ", "団子"],
      hint: "〇〇には何かが入るわけではありません。\nそのまま声に出して読んでみよう。",
      explanation: "\"さわると丸まる虫\"といえばダンゴムシですね！",
    },
    {
      question: "パンはパンでも、\n「day + book」はな～んだ？",
      answers: ["ジャパン", "JAPAN"],
      hint: "英語 → 日本語 → 英語",
      explanation: "英語の「day」と「book」を日本語にして、\n「日」と「本」を組み合わせたら「日本」になり、\nそれを英語に戻すと「ジャパン」になります。",
    },
    {
      question: "パンはパンでも、\n「P & A」はな～んだ？",
      answers: ["パンダ", "PANDA"],
      hint: "AND",
      explanation: "英語の「P」と「AND」と「A」を組み合わせて「PANDA（パンダ）」になります。",
    },
    {
      question: "シロナガスクジラが一日に食べるのは何トン？",
      answers: ["プランクトン"],
      hint: "重さではなく、最後にトンがつく言葉が正解。\nヒゲクジラ類が何を食べるか知ってる？",
      explanation: "ヒゲクジラ類はプランクトンを食べています。",
    },
  ],
  2: [
    {
      question: "海 + 息子 = 季節\n？ - 彼 = 芸術",
      answers: ["心", "こころ", "心臓", "しんぞう"],
      hint: "英語が関係します。",
      explanation: "sea + son = season\nheart - he = art",
    },
    {
      question: "のむと驚いたり感動し、\n殺しても生きている。\nそれを引き取るとどうなるか？",
      answers: ["死ぬ", "しぬ", "亡くなる", "なくなる"],
      hint: "～をのむ、\n～を殺す、\n～を引き取る",
      explanation: "すべて息という言葉を使う慣用句です",
    },
    {
      question: "訪問するときにはそれを出し、\nそれが大きいと態度も大きく、\nそれが立つと名誉が傷つかない。\n\nそれが売れるとどうなるか？",
      answers: ["有名になる", "ゆうめいになる", "名が売れる", "ながうれる"],
      hint: "体の一部を使った慣用句だよ",
      explanation: "すべて顔という言葉を使う慣用句です",
    },
    {
      question: "それが堅い人ほど、\nそれに出すときは注意深く、\nそれが酸っぱいほど回数が多い。\n\nそれが重いほど数はどうなる？",
      answers: ["減る", "へる", "少なくなる", "すくなくなる", "少ない", "すくない"],
      hint: "それは顔の中にあるよ",
      explanation: "すべて口という言葉を使う慣用句です",
    },
    {
      question: "次の５つに共通することは何でしょう？\n「開始」「姉妹」「牡蠣」「からし」「復活祭」",
      answers: ["スターが含まれる", "ほし", "星", "☆", "スター"],
      hint: "英語が関係します。",
      explanation: "すべて英語にしてカタカナ読みすると「スター」が含まれる言葉です",
    },
    {
      question: "「口」「岡」「？？」「富」「梨」「形」\n\nハテナに入る漢字二文字は？",
      answers: ["和歌"],
      hint: "全て都道府県が関係します",
      explanation: "すべて山がつく都道府県です。",
    },
    {
      question: "「男性」は「宮城」\n「古風」は「山梨」\n「富」は「茨城」\n「花」は「？？」",
      answers: ["沖縄", "おきなわ"],
      hint: "左側の言葉を仮名にして並べ替えてみよう",
      explanation: "左側の言葉は、県庁所在地のアナグラムです。",
    },
  ],
  3: [
    {
      question: "\"Dragon + Miyagi\"\n\nここへ行ったのは誰でしょう？",
      answers: ["浦島太郎", "浦島", "うらしま"],
      hint: "DragonとMiyagiをそれぞれ漢字にしてみよう",
      explanation: "Dragonは「竜」Miyagiは「宮城」\nそれらを繋げると「竜宮城」となり、\nそこへ行った「浦島太郎」が正解となります。",
    },
    {
      question: "雨 + 弓 = ？\n\nハテナに入る漢字一文字は何でしょう？",
      answers: ["虹"],
      hint: "雨と弓をそれぞれ英語にして繋げてみよう",
      explanation: "雨は「rain」、弓は「bow」\nそれらを繋げると「rainbow」つまり「虹」が正解です。",
    },
    {
      question: "雨空を裸眼で見ると何が見えるでしょう？",
      answers: ["アマゾン", "Amazon"],
      hint: "「アマゾラ」と「ラガン」",
      explanation: "「アマゾラ」の「ラ」が「ン」になると、「アマゾン」になります。",
    },
  ],
  4: [
    {
      question: "「坊っちゃん」を書いた作家は誰ですか？",
      answers: ["夏目漱石"],
    },
    {
      question: "シェイクスピアの有名な悲劇「〇〇と〇〇」の主人公の名前は？ (ヒント: 若い恋人たち)",
      answers: ["ロミオとジュリエット"],
    },
    { question: "「こころ」を書いた日本の文豪は？", answers: ["夏目漱石"] },
    { question: "走れメロス」の作者は誰ですか？", answers: ["太宰治"] },
    { question: "「人間失格」を書いた作家は？", answers: ["太宰治"] },
  ],
  5: [
    {
      question: "日本で一番面積が大きい都道府県はどこですか？",
      answers: ["北海道"],
    },
    { question: "「万里の長城」がある国は？", answers: ["中国"] },
    { question: "アマゾン川が流れる大陸は？", answers: ["南アメリカ", "南米"] },
    {
      question: "世界で一番高い山は？",
      answers: ["エベレスト", "チョモランマ"],
    },
    { question: "日本で一番深い湖は？", answers: ["田沢湖"] },
  ],
  6: [
    {
      question: "ベートーベンの「運命」は第何番交響曲ですか？",
      answers: ["5", "五", "第五"],
    },
    { question: "モーツァルトの出身国は？", answers: ["オーストリア"] },
    {
      question: "「四季」を作曲したイタリアの作曲家は？",
      answers: ["ヴィヴァルディ", "ビバルディ"],
    },
    {
      question: "日本の国歌「君が代」の作曲者は誰ですか？",
      answers: ["林廣守", "はやしひろもり"],
    },
    { question: "ピアノの鍵盤の数は一般的に何個ですか？", answers: ["88"] },
  ],
};

export async function GET() {
  return NextResponse.json(quizData);
}

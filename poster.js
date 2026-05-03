require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const http = require('http');

// Render-ზე პორტი ხშირად დინამიურია, ამიტომ process.env.PORT აუცილებელია
const PORT = process.env.PORT || 3000;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// პროცესის ჩამკეტი (Lock), რომ სერვერმა პარალელურად ორი რექვესთი არ დაამუშაოს
let isProcessing = false;

async function postToFacebook() {
     if (isProcessing) {
          console.log('⏳ პროცესი უკვე მიმდინარეობს, გთხოვთ დაიცადოთ...');
          return { success: false, message: 'პროცესი უკვე მიმდინარეობს...' };
     }

     isProcessing = true;
     console.log('🚀 პროცესი დაიწყო: უახლესი პროდუქტის ძებნა...');

     try {
          // 1. ვიღებთ მხოლოდ 1 პროდუქტს, რომელიც ჯერ არ დაპოსტილა.
          // ვიყენებთ .order('id', { ascending: true }), რომ ყოველთვის ყველაზე ძველი რიგითი აიღოს
          const { data, error } = await supabase
               .from('ITVET pixelshop products table')
               .select('*')
               .eq('is_posted', false)
               .order('id', { ascending: true })
               .limit(1);

          if (error) throw new Error(`Supabase Fetch Error: ${error.message}`);

          if (!data || data.length === 0) {
               console.log('ℹ️ ყველა პროდუქტი უკვე დაპოსტილია.');
               isProcessing = false;
               return { success: false, message: 'ახალი პროდუქტები არ არის' };
          }

          const product = data[0];

          // 🛡️ ატომური განახლება: ვცვლით სტატუსს მხოლოდ იმ შემთხვევაში, თუ ის ისევ false-ია.
          // ეს არის მთავარი დაზღვევა გაორების წინააღმდეგ.
          const { data: updateCheck, error: updateError } = await supabase
               .from('ITVET pixelshop products table')
               .update({ is_posted: true })
               .match({ id: product.id, is_posted: false })
               .select();

          if (updateError || !updateCheck || updateCheck.length === 0) {
               console.log('⚠️ ეს პროდუქტი უკვე მუშავდება სხვა პროცესის მიერ.');
               isProcessing = false;
               return { success: false, message: 'გაორება აცილებულია' };
          }

          console.log(`⏳ ვპოსტავ Facebook-ზე: ${product.title}`);

          // 2. პოსტვა Facebook-ზე
          const fbUrl = `https://graph.facebook.com/v19.0/${process.env.FB_PAGE_ID}/photos`;

          await axios.post(fbUrl, {
               url: product.image,
               caption: `🛍️ ${product.title}\n💰 ფასი: ${product.price} ლარი\n\n#ITVET #PixelShop`,
               access_token: process.env.FB_ACCESS_TOKEN
          });

          console.log(`✅ წარმატებით დაიდო: ${product.title}`);
          isProcessing = false;
          return { success: true, title: product.title };

     } catch (err) {
          isProcessing = false;
          const errMsg = err.response ? err.response.data.error.message : err.message;
          console.error('❌ შეცდომა:', errMsg);
          return { success: false, error: errMsg };
     }
}

// HTTP სერვერი
const server = http.createServer(async (req, res) => {
     res.setHeader('Access-Control-Allow-Origin', '*');
     res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

     if (req.url === '/post-now') {
          const result = await postToFacebook();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
     } else {
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('ITVET PixelShop ბოტი მზადაა! გამოსაყენებლად ეწვიეთ /post-now');
     }
});

server.listen(PORT, () => {
     console.log(`📡 სერვერი ჩაირთო პორტზე: ${PORT}`);
});
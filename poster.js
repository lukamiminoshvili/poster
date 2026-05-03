require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const http = require('http');

const PORT = process.env.PORT || 3000;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ცვლადი მეხსიერებაში, რომ ამავე პროცესმა ორჯერ არ გაუშვას ფუნქცია
let isProcessing = false;

async function postToFacebook() {
     if (isProcessing) {
          return { success: false, message: 'პროცესი უკვე მიმდინარეობს...' };
     }

     console.log('🚀 პროცესი დაიწყო: ვამოწმებ ახალ პროდუქტებს...');
     isProcessing = true;

     try {
          // 1. ვიღებთ მხოლოდ 1 პროდუქტს
          const { data, error } = await supabase
               .from('ITVET pixelshop products table')
               .select('*')
               .eq('is_posted', false)
               .order('id', { ascending: true })
               .limit(1);

          if (error) throw new Error(`Supabase Error: ${error.message}`);

          if (!data || data.length === 0) {
               console.log('ℹ️ დაუპოსტავი პროდუქტები არ მოიძებნა.');
               isProcessing = false;
               return { success: false, message: 'ახალი პროდუქტები არ არის' };
          }

          const product = data[0];

          // 🛡️ დამატებითი დაზღვევა: ვამოწმებთ, ხომ არ დაასწრო სხვა პროცესმა
          // ვცდილობთ განვაახლოთ მხოლოდ იმ შემთხვევაში, თუ ისევ false-ია
          const { data: updateCheck, error: updateError } = await supabase
               .from('ITVET pixelshop products table')
               .update({ is_posted: true })
               .match({ id: product.id, is_posted: false }) // მხოლოდ თუ ისევ false-ია
               .select();

          // თუ update-მა არ დააბრუნა მონაცემი, ნიშნავს რომ სხვა პროცესმა დაასწრო
          if (updateError || !updateCheck || updateCheck.length === 0) {
               console.log('⚠️ პოსტი უკვე აღებულია სხვა პროცესის მიერ.');
               isProcessing = false;
               return { success: false, message: 'გაორება აცილებულია' };
          }

          console.log(`⏳ ვპოსტავ: ${product.title}`);

          // 2. ფოტოს ატვირთვა Facebook-ზე
          const fbUrl = `https://graph.facebook.com/v19.0/${process.env.FB_PAGE_ID}/photos`;

          await axios.post(fbUrl, {
               url: product.image,
               caption: `🛍️ ${product.title}\n💰 ფასი: ${product.price} ლარი`,
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

http.createServer(async (req, res) => {
     res.setHeader('Access-Control-Allow-Origin', '*');
     res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

     if (req.url === '/post-now') {
          const result = await postToFacebook();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
     } else {
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('ბოტი მზადაა!');
     }
}).listen(PORT);
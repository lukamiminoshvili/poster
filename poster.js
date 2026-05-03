require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const http = require('http');

const PORT = process.env.PORT || 3000;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function postToFacebook() {
     console.log('🚀 პროცესი დაიწყო: ვამოწმებ ახალ პროდუქტებს...');
     try {
          // 1. ვიღებთ მხოლოდ 1 პროდუქტს, რომელიც ჯერ არ დაპოსტილა
          const { data, error } = await supabase
               .from('ITVET pixelshop products table')
               .select('*')
               .eq('is_posted', false)
               .order('id', { ascending: true })
               .limit(1);

          if (error) throw new Error(`Supabase Error: ${error.message}`);

          if (!data || data.length === 0) {
               console.log('ℹ️ დაუპოსტავი პროდუქტები არ მოიძებნა.');
               return { success: false, message: 'ახალი პროდუქტები არ არის' };
          }

          const product = data[0];

          // 🛡️ კრიტიკული ნაბიჯი: ჯერ ვბლოკავთ პროდუქტს ბაზაში (is_posted = true)
          // ეს გამორიცხავს გაორებას, თუ Render-მა პარალელური პროცესი გაუშვა
          const { error: updateError } = await supabase
               .from('ITVET pixelshop products table')
               .update({ is_posted: true })
               .eq('id', product.id);

          if (updateError) throw new Error(`Update Error: ${updateError.message}`);

          console.log(`⏳ ვპოსტავ: ${product.title}`);

          // 2. ფოტოს ატვირთვა Facebook-ზე
          const fbUrl = `https://graph.facebook.com/v19.0/${process.env.FB_PAGE_ID}/photos`;

          await axios.post(fbUrl, {
               url: product.image,
               caption: `🛍️ ${product.title}\n💰 ფასი: ${product.price} ლარი`,
               access_token: process.env.FB_ACCESS_TOKEN
          });

          console.log(`✅ წარმატებით დაიდო: ${product.title}`);
          return { success: true, title: product.title };

     } catch (err) {
          const errMsg = err.response ? err.response.data.error.message : err.message;
          console.error('❌ შეცდომა:', errMsg);
          return { success: false, error: errMsg };
     }
}

// სერვერის შექმნა, რომელსაც iPhone-ის Shortcut-ი დაუკავშირდება
http.createServer(async (req, res) => {
     // CORS მხარდაჭერა
     res.setHeader('Access-Control-Allow-Origin', '*');
     res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

     if (req.url === '/post-now') {
          const result = await postToFacebook();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
     } else {
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('ITVET ბოტი მუშაობს და მზადაა!');
     }
}).listen(PORT, () => {
     console.log(`📡 სერვერი ჩაირთო პორტზე: ${PORT}`);
});
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const http = require('http');

// პორტის განსაზღვრა Render-ისთვის
const PORT = process.env.PORT || 3000;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function postToFacebook() {
     console.log('🚀 პროცესი დაიწყო: ვამოწმებ ახალ პროდუქტებს...');
     try {
          const { data, error } = await supabase
               .from('ITVET pixelshop products table')
               .select('*')
               .eq('is_posted', false)
               .order('id', { ascending: true })
               .limit(1);

          if (error) throw error;
          if (!data || data.length === 0) {
               return { success: false, message: 'ბაზაში ყველა პროდუქტი უკვე დაპოსტილია!' };
          }

          const product = data[0];
          const message = `🛍️ იჩქარეთ! მხოლოდ ჩვენთან:\n\n📌 ${product.title}\n💰 ფასი: ${product.price} ლარი\n\nმოგვწერეთ შესაძენად! ✨`;

          console.log(`⏳ ვპოსტავ: ${product.title}`);

          const fbUrl = `https://graph.facebook.com/v19.0/${process.env.FB_PAGE_ID}/photos`;

          await axios.post(fbUrl, {
               url: product.image,
               caption: message,
               access_token: process.env.FB_ACCESS_TOKEN
          });

          const { error: updateError } = await supabase
               .from('ITVET pixelshop products table')
               .update({ is_posted: true })
               .eq('id', product.id);

          if (updateError) throw updateError;

          console.log(`✅ წარმატებით დაიდო: ${product.title}`);
          return { success: true, title: product.title };

     } catch (err) {
          const errMsg = err.response ? err.response.data.error.message : err.message;
          console.error('❌ შეცდომა:', errMsg);
          return { success: false, error: errMsg };
     }
}

// სერვერის შექმნა
http.createServer(async (req, res) => {
     // CORS-ის დამატება, რომ აიფონმა არ დაჰბლოკოს მოთხოვნა
     res.setHeader('Access-Control-Allow-Origin', '*');
     res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

     if (req.url === '/post-now') {
          const result = await postToFacebook();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
     } else {
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('ბოტი ჩართულია და მუშაობს! გამოიყენე /post-now პოსტის დასადებად.');
     }
}).listen(PORT, () => {
     console.log(`✅ სერვერი ჩაირთო პორტზე: ${PORT}`);
});
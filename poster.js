require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const cron = require('node-cron');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function postToFacebook() {
     console.log('🚀 პროცესი დაიწყო: ვამოწმებ ახალ პროდუქტებს...');

     try {
          // 1. ვიღებთ პირველივე პროდუქტს, რომელიც ჯერ არ დადებულა (is_posted === false)
          const { data, error } = await supabase
               .from('ITVET pixelshop products table')
               .select('*')
               .eq('is_posted', false)
               .order('id', { ascending: true })
               .limit(1);

          if (error) throw error;

          if (!data || data.length === 0) {
               console.log('⚠️ ბაზაში ყველა პროდუქტი უკვე დაპოსტილია!');
               return;
          }

          const product = data[0];

          // ტექსტის ფორმატირება
          const message = `🛍️ იჩქარეთ! მხოლოდ ჩვენთან:\n\n📌 ${product.title}\n💰 ფასი: ${product.price} ლარი\n\nმოგვწერეთ შესაძენად! ✨`;

          console.log(`⏳ ვპოსტავ: ${product.title}`);

          // 2. ფეისბუქზე დაპოსტვა
          const fbUrl = `https://graph.facebook.com/v19.0/${process.env.FB_PAGE_ID}/photos`;

          await axios.post(fbUrl, {
               url: product.image,
               caption: message,
               access_token: process.env.FB_ACCESS_TOKEN
          });

          // 3. სტატუსის განახლება Supabase-ში
          const { updateError } = await supabase
               .from('ITVET pixelshop products table')
               .update({ is_posted: true })
               .eq('id', product.id);

          if (updateError) throw updateError;

          console.log(`✅ წარმატებით დაიდო და მოინიშნა: ${product.title}`);

     } catch (err) {
          if (err.response) {
               console.error('❌ Facebook Error:', err.response.data.error.message);
          } else {
               console.error('❌ შეცდომა:', err.message);
          }
     }
}

// ... (კავშირის და ცვლადების ნაწილი იგივეა)

// ეს ფუნქცია იგივე რჩება, რაც გვქონდა
async function postToFacebook() {
     try {
          const { data, error } = await supabase
               .from('ITVET pixelshop products table')
               .select('*')
               .eq('is_posted', false)
               .order('id', { ascending: true })
               .limit(1);

          if (error || !data.length) return { success: false, message: 'პროდუქტები არ არის' };

          const product = data[0];
          const fbUrl = `https://graph.facebook.com/v19.0/${process.env.FB_PAGE_ID}/photos`;

          await axios.post(fbUrl, {
               url: product.image,
               caption: `🛍️ ${product.title}\n💰 ფასი: ${product.price} ლარი`,
               access_token: process.env.FB_ACCESS_TOKEN
          });

          await supabase
               .from('ITVET pixelshop products table')
               .update({ is_posted: true })
               .eq('id', product.id);

          return { success: true, title: product.title };
     } catch (err) {
          return { success: false, error: err.message };
     }
}

// ვამატებთ მარშრუტს (Route) ღილაკისთვის
http.createServer(async (req, res) => {
     // თუ ვინმე შევა მისამართზე /post-now
     if (req.url === '/post-now') {
          const result = await postToFacebook();
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify(result));
     } else {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('Bot is running!');
     }
}).listen(port);
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

// დაგეგმვა ყოველდღე 14:00-ზე (Tbilisi Time)
cron.schedule('0 14 * * *', () => {
     postToFacebook();
}, {
     timezone: "Asia/Tbilisi"
});

// პირველი გაშვება ტესტისთვის (შეგიძლია წაშალო, როცა დარწმუნდები რომ მუშაობს)
postToFacebook();

const http = require('http');
const port = process.env.PORT || 3000;

http.createServer((req, res) => {
     res.writeHead(200, { 'Content-Type': 'text/plain' });
     res.end('Bot is running!');
}).listen(port, () => {
     console.log(`Server is listening on port ${port}`);
});
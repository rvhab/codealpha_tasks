// Creates demo users, posts, likes and comments the first time the server starts on an empty database.
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Post = require('./models/Post');
const Comment = require('./models/Comment');

const USERS = [
  ['ayesha_k', 'Designer. Coffee first, pixels second.'],
  ['bilal_dev', 'Full stack dev. Node and Mongo lover.'],
  ['sara_m', 'Photographer and weekend traveler.'],
  ['omar_s', 'Gym, gaming and good memes.'],
  ['zainab_a', 'Books, tea and long walks.'],
  ['hamza_r', 'Cricket fan. Fast bowler in my dreams.'],
  ['maryam_art', 'Painting the world one canvas at a time.'],
  ['daniyal_t', 'Chef in training. Biryani is a love language.']
];

// [author, text, image seed (null = text only), image height, hours ago, comments [[user, text]]]
const POSTS = [
  [0, 'Clean layout and two accent colours beat any fancy gradient.', 'desk', 420, 3, [[1, 'Agreed. Simple wins.'], [6, 'Love the palette!']]],
  [1, 'Finished my first Express + MongoDB project today!', null, 0, 5, [[2, 'Congrats! Share the repo?'], [0, 'Big win, well done.']]],
  [2, 'Golden hour in the northern hills. Nothing beats this view.', 'mountain', 300, 7, [[4, 'Stunning colours!'], [5, 'Which camera did you use?'], [3, 'Adding this place to my list.']]],
  [3, 'New personal best at the gym today. Consistency is everything.', 'gym', 380, 10, [[5, 'Beast mode!']]],
  [4, 'Just finished a great novel. Any recommendations for the weekend?', 'books', 340, 14, [[2, 'Try anything by Elif Shafak.'], [0, 'Count me in for suggestions too.']]],
  [5, 'Sunday cricket with the boys. What a match.', 'cricket', 280, 20, [[3, 'Next time I am in.']]],
  [6, 'Finished this canvas after three weeks. Colours everywhere!', 'paint', 440, 26, [[0, 'This is gorgeous.'], [4, 'Frame it!']]],
  [7, 'Sunday biryani, slow cooked for four hours.', 'food', 320, 30, [[2, 'Save me a plate!'], [1, 'Recipe please.']]],
  [2, 'Chasing sunsets by the sea.', 'sunset', 260, 40, [[6, 'Dreamy.']]],
  [0, 'Moodboard for a new brand. Warm, bold and a bit playful.', 'mood', 360, 52, [[1, 'Cannot wait to see it.']]],
  [1, 'Tip: build the backend first, then design the frontend to match the API.', null, 0, 60, [[7, 'Solid advice.'], [3, 'Noted!']]],
  [6, 'Sketching in the garden this morning.', 'garden', 300, 70, [[7, 'Peaceful.']]],
  [4, 'Tea, rain and a good book. Perfect evening.', 'rain', 400, 80, [[0, 'Mood.'], [5, 'Take me with you.']]],
  [3, 'Weekend trek with friends. Legs are dead, soul is alive.', 'trek', 290, 96, [[2, 'Goals!']]]
];

module.exports = async () => {
  const pw = await bcrypt.hash('password123', 10);
  const users = await User.insertMany(USERS.map(([username, bio]) => ({ username, bio, email: username + '@demo.com', password: pw, avatar: `https://i.pravatar.cc/150?u=${username}` })));

  users.forEach((u, i) => [1, 2, 4].forEach(k => {
    const t = users[(i + k) % users.length];
    u.following.push(t._id); t.followers.push(u._id);
  }));
  await Promise.all(users.map(u => u.save()));

  const now = Date.now();
  const posts = await Post.insertMany(POSTS.map(([a, content, seed, h, hrs], i) => ({
    author: users[a]._id,
    content,
    image: seed ? `https://picsum.photos/seed/${seed}/700/${h}` : '',
    likes: users.filter((_, j) => j !== a && (j + i) % 3 !== 0).map(u => u._id),
    createdAt: new Date(now - hrs * 3600000)
  })));

  const comments = [];
  POSTS.forEach(([, , , , hrs, cms], i) => cms.forEach(([u, text], k) => comments.push({
    post: posts[i]._id, author: users[u]._id, text,
    createdAt: new Date(now - (hrs * 60 - 10 * (k + 1)) * 60000)
  })));
  await Comment.insertMany(comments);
};

// Gives demo users their profile photos (also fixes demo users created by an earlier version)
module.exports.ensureAvatars = async () => {
  for (const [u] of USERS) await User.updateOne({ username: u, avatar: '' }, { avatar: `https://i.pravatar.cc/150?u=${u}` });
};

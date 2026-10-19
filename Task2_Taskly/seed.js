// Demo users, projects, tasks and comments - created on the first start with an empty database
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Project = require('./models/Project');
const Task = require('./models/Task');
const Comment = require('./models/Comment');

const NAMES = ['ayesha_k', 'bilal_dev', 'sara_m', 'omar_s', 'hamza_r', 'zainab_a', 'maryam_k'];
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

// [title, status, assignee, priority, label, due offset (days), description, [[commenter, text]]]
const PROJECTS = [
  { name: 'Buzz mobile app', color: '#4F46E5', owner: 'ayesha_k', members: ['ayesha_k', 'bilal_dev', 'sara_m', 'omar_s', 'hamza_r'], tasks: [
    ['Write API documentation', 'todo', 'bilal_dev', 'low', 'Docs', 13, 'Document every endpoint with request and response examples.'],
    ['Set up push notifications', 'todo', 'sara_m', 'med', 'Backend', 11, 'Use WebSockets for real-time alerts first, then add mobile push.'],
    ['Research competitor apps', 'todo', 'omar_s', 'low', 'Research', 17, 'Compare onboarding, feeds and stories in three competitor apps.'],
    ['Build profile page', 'prog', 'ayesha_k', 'high', 'Frontend', 5, 'Cover image, avatar upload, stats and the post grid.', [['bilal_dev', 'Cover image looks great. Can we add a follow button too?'], ['ayesha_k', 'Yes, adding it today.']]],
    ['Implement follow system API', 'prog', 'bilal_dev', 'high', 'Backend', -2, 'Follow and unfollow endpoints plus the suggestions query.', [['ayesha_k', 'This is blocking the profile page. Any ETA?'], ['bilal_dev', 'Finishing tests, should be ready tomorrow.']]],
    ['Story viewer animations', 'rev', 'sara_m', 'med', 'Design', 4, 'Progress bars, auto-advance and tap zones.', [['ayesha_k', 'Looks smooth. Approved from my side.']]],
    ['Fix login redirect bug', 'rev', 'hamza_r', 'high', 'Bug', 1, 'Users land on a blank page after login on Safari.', [['sara_m', 'Reproduced on iOS 17.'], ['hamza_r', 'Fix is in review, please test.']]],
    ['Create database schema', 'done', 'bilal_dev', 'med', 'Backend', -6, 'Users, posts, comments and follows collections.'],
    ['Design system and colour palette', 'done', 'ayesha_k', 'med', 'Design', -8, 'Type scale, colours and component library.', [['omar_s', 'Great work, very consistent.']]],
    ['Set up GitHub repository', 'done', 'omar_s', 'low', 'Docs', -10, 'Repo, branch rules and README.']
  ] },
  { name: 'Website redesign', color: '#0D9488', owner: 'ayesha_k', members: ['ayesha_k', 'bilal_dev', 'sara_m', 'zainab_a'], tasks: [
    ['Audit current site', 'done', 'sara_m', 'med', 'Research', -9, 'Traffic, bounce rate and top landing pages.'],
    ['Wireframe homepage', 'done', 'ayesha_k', 'high', 'Design', -5, 'Low fidelity layouts for desktop and mobile.'],
    ['Design hero section', 'prog', 'ayesha_k', 'high', 'Design', 2, 'New headline, imagery and call to action.', [['zainab_a', 'Try a bolder headline.']]],
    ['Build responsive navbar', 'prog', 'bilal_dev', 'med', 'Frontend', 4, 'Sticky nav with a mobile drawer.'],
    ['Write homepage copy', 'todo', 'zainab_a', 'med', 'Content', 7, 'Short, benefit-led copy for each section.'],
    ['Fix image loading bug', 'rev', 'sara_m', 'high', 'Bug', -1, 'Hero image blocks first paint.']
  ] },
  { name: 'Marketing launch', color: '#EA580C', owner: 'zainab_a', members: ['zainab_a', 'ayesha_k', 'sara_m', 'omar_s', 'maryam_k'], tasks: [
    ['Define launch goals', 'done', 'zainab_a', 'high', 'Docs', -7, 'Target signups, channels and budget.'],
    ['Prepare social media calendar', 'prog', 'maryam_k', 'med', 'Content', 3, 'Four weeks of posts across platforms.'],
    ['Record product demo video', 'todo', 'omar_s', 'high', 'Content', 9, 'Two minute walkthrough for LinkedIn.'],
    ['Email campaign draft', 'rev', 'sara_m', 'med', 'Content', 6, 'Announcement email and two follow-ups.', [['zainab_a', 'Subject line needs to be punchier.']]],
    ['Influencer outreach list', 'todo', 'ayesha_k', 'low', 'Research', 14, 'Shortlist 20 creators in our niche.']
  ] }
];

module.exports = async () => {
  const pw = await bcrypt.hash('password123', 10);
  const users = await User.insertMany(NAMES.map(u => ({ username: u, email: u + '@demo.com', password: pw })));
  const id = Object.fromEntries(users.map(u => [u.username, u._id]));

  for (const P of PROJECTS) {
    const p = await Project.create({ name: P.name, color: P.color, owner: id[P.owner], members: P.members.map(m => id[m]), demo: true });
    let order = Date.now();
    for (const [title, status, who, priority, label, due, description, cms] of P.tasks) {
      const t = await Task.create({ project: p._id, title, status, priority, label, description, assignee: id[who], due: day(due), order: order++, createdBy: p.owner });
      if (cms) await Comment.insertMany(cms.map(([u, text], i) => ({ task: t._id, author: id[u], text, createdAt: new Date(Date.now() - (cms.length - i) * 3600000) })));
    }
  }
};

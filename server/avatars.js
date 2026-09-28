// Catalogue of mystery identities. Each one can be claimed by exactly one
// participant, so an avatar doubles as an anonymous identity for the whole
// pre-event phase.
const ANIMALS = [
  ['\u{1F98A}','Fox'],['\u{1F989}','Owl'],['\u{1FACE}','Moose'],['\u{1F43A}','Wolf'],['\u{1F43B}','Bear'],
  ['\u{1F98C}','Deer'],['\u{1F43F}️','Squirrel'],['\u{1F994}','Hedgehog'],['\u{1F9A2}','Swan'],['\u{1F9AD}','Seal'],
  ['\u{1F9A6}','Otter'],['\u{1F41F}','Perch'],['\u{1F407}','Hare'],['\u{1F985}','Eagle'],['\u{1F427}','Puffin'],
  ['\u{1F408}','Lynx'],['\u{1F415}','Husky'],['\u{1F987}','Bat'],['\u{1F41D}','Bee'],['\u{1F98B}','Moth'],
  ['\u{1F41E}','Ladybird'],['\u{1F40C}','Snail'],['\u{1F419}','Octopus'],['\u{1F991}','Squid'],['\u{1F980}','Crab'],
  ['\u{1F420}','Minnow'],['\u{1F42C}','Dolphin'],['\u{1F433}','Whale'],['\u{1F988}','Shark'],['\u{1F9A9}','Flamingo'],
  ['\u{1F99C}','Parrot'],['\u{1F99A}','Peacock'],['\u{1F983}','Grouse'],['\u{1F413}','Rooster'],['\u{1F986}','Duck'],
  ['\u{1F54A}️','Dove'],['\u{1F422}','Turtle'],['\u{1F98E}','Gecko'],['\u{1F40D}','Adder'],['\u{1F996}','Rex'],
  ['\u{1F409}','Dragon'],['\u{1F984}','Unicorn'],['\u{1F434}','Horse'],['\u{1F993}','Zebra'],['\u{1F992}','Giraffe'],
  ['\u{1F418}','Elephant'],['\u{1F99B}','Hippo'],['\u{1F98F}','Rhino'],['\u{1F42A}','Camel'],['\u{1F999}','Llama'],
  ['\u{1F411}','Lamb'],['\u{1F410}','Goat'],['\u{1F404}','Cow'],['\u{1F416}','Boar'],['\u{1F400}','Mouse'],
  ['\u{1F9AB}','Badger'],['\u{1F9A1}','Beaver'],['\u{1F9A8}','Skunk'],['\u{1F9A5}','Sloth'],['\u{1F998}','Kangaroo'],
  ['\u{1F428}','Koala'],['\u{1F43C}','Panda'],['\u{1F981}','Lion'],['\u{1F42F}','Tiger'],['\u{1F406}','Leopard'],
  ['\u{1F412}','Monkey'],['\u{1F98D}','Gorilla'],['\u{1F9A7}','Orangutan'],['\u{1F438}','Frog'],['\u{1F42B}','Bactrian'],
  ['\u{1F995}','Diplodocus'],['\u{1F41B}','Caterpillar']
];
const ADJECTIVES = ['Arctic','Midnight','Nordic','Amber','Silver','Aurora','Birch','Harbour','Lantern','Frost','Copper','Velvet'];
const TINTS = ['#E3F0FC','#FCE4EC','#DFF3E9','#FDEFDC','#EDE7FB','#E6F6F8'];

const AVATARS = ANIMALS.map(function (a, i) {
  return {
    id: 'av' + (i + 1),
    emoji: a[0],
    codename: ADJECTIVES[i % ADJECTIVES.length] + ' ' + a[1],
    tint: TINTS[i % TINTS.length]
  };
});

const BY_ID = new Map(AVATARS.map(function (a) { return [a.id, a]; }));

module.exports = { AVATARS, getAvatar: function (id) { return BY_ID.get(id) || null; } };

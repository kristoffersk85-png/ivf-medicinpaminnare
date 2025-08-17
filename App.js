import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Switch, Alert, useColorScheme, ScrollView, FlatList } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// ===== Theme =====
const THEME = {
  coral: '#FF6F6F',
  bgLight: '#FFFFFF',
  textLight: '#0F0F10',
  bgDark: '#0E0E0F',
  textDark: '#F2F2F2',
  cardLight: '#FFFFFF',
  cardDark: '#17171A',
  borderLight: '#EAEAEA',
  borderDark: '#2A2A2F',
  chipBgLight: '#F6F6F7',
  chipBgDark: '#1E1E22',
  success: '#2E7D32',
  danger: '#C62828',
  dimLight: '#646870',
  dimDark: '#9AA0A6'
};

// ===== Storage keys =====
const STORAGE_KEYS = {
  hasOnboarded: 'ivf_has_onboarded',
  settings: 'ivf_settings_v2',     // v2 pga nytt fält transferDate
  medicines: 'ivf_medicines_v1',
  statusDaily: 'ivf_status_daily_v1',
  schedules: 'ivf_schedules_v1'
};

// ===== Defaults =====
const DEFAULT_SETTINGS = {
  appName: 'IVF Påminnare',
  startDate: '',                         // ÅÅÅÅ-MM-DD
  transferDate: '',                      // Insättningsdatum ÅÅÅÅ-MM-DD
  totalDays: 26,
  times: ['08:00', '14:00', '22:00'],
  nagMinutes: 15,
  soundEnabled: true,
  hapticsEnabled: true
};

const DEFAULT_MEDICINES = [
  { id: 'est',  name: 'Estrofem',    dose: '2 mg',   icon: '💊', color: '#FF9AA2', enabled: true,  times: ['08:00','14:00','22:00'] },
  { id: 'prog', name: 'Progesteron', dose: '200 mg', icon: '🌙', color: '#B5EAD7', enabled: true,  times: ['22:00'] },
  { id: 'prol', name: 'Prolutex',    dose: 'daglig', icon: '💉', color: '#C7CEEA', enabled: false, times: ['08:00'] }
];

// ===== Pepp-meddelanden (slumpas när allt klart) =====
const MESSAGES = [
  'Snyggt! Bra jobbat älskling, du är bäst! ❤️',
  'Allt taget idag – du är en stjärna! ✨',
  'Heja er! Ett steg närmare målet 💖',
  'Fantastiskt! Kroppen tackar och bockar 🙌',
  'Du fixade det – jag är stolt över dig 💪❤️',
  'Perfekt genomfört idag! 🌟',
  'Magiskt tempo – bra jobbat! 🧡'
];

// ===== Utils =====
async function save(key, value){ await SecureStore.setItemAsync(key, JSON.stringify(value)); }
async function load(key){ const v = await SecureStore.getItemAsync(key); return v ? JSON.parse(v) : null; }
function formatDate(d){ return d.toISOString().split('T')[0]; }
function parseISODateOrNull(s){ if(!s) return null; const d = new Date(s + 'T00:00:00'); return isNaN(d.getTime()) ? null : d; }
function dayNumber(startDateStr, today = new Date()){
  const start = parseISODateOrNull(startDateStr);
  if(!start) return null;
  const diff = Math.floor((new Date(today.toDateString()) - start)/(1000*60*60*24));
  return diff + 1;
}
function parseTimeToDate(timeHHMM, base = new Date()){
  const [hh, mm] = timeHHMM.split(':').map(Number);
  const t = new Date(base);
  t.setHours(hh); t.setMinutes(mm); t.setSeconds(0); t.setMilliseconds(0);
  return t;
}
function addMinutes(date, mins){ return new Date(date.getTime() + mins*60000); }
function clamp01(x){ return Math.max(0, Math.min(1, x)); }
function daysBetween(a, b){ const ms = 24*60*60*1000; const A = new Date(a.toDateString()); const B = new Date(b.toDateString()); return Math.round((B - A)/ms); }

// ===== Notifications handler =====
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,   // i en build kan vi koppla mot settings.soundEnabled
    shouldSetBadge: false,
  }),
});

// ===== Onboarding =====
function Onboarding({ onDone }){
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const slides = [
    { title: 'Välkommen 👋', text: 'Appen hjälper dig och din sambo att komma ihåg rätt mediciner vid rätt tid under IVF.' },
    { title: 'Hem', text: 'Se Dag X av Y och markera doser (08/14/22) som tagna.' },
    { title: 'Mediciner', text: 'Slå på/av mediciner och välj vilka tider som gäller.' },
    { title: 'Pepp ❤️', text: 'När allt är taget för dagen får du ett motiverande meddelande.' }
  ];
  const [i, setI] = useState(0);

  return (
    <View style={[styles.screen, {backgroundColor: isDark ? THEME.bgDark : THEME.bgLight}]}>
      <Text style={[styles.appTitle, {color: isDark ? THEME.textDark : THEME.textLight}]}>IVF Påminnare</Text>

      <View style={[styles.card, {backgroundColor: isDark ? THEME.cardDark : THEME.cardLight, borderColor: isDark ? THEME.borderDark : THEME.borderLight}]}>
        <View style={{alignItems:'center', marginBottom:14}}>
          <Text style={{fontSize:56}}>❤️💊</Text>
        </View>
        <Text style={[styles.slideTitle, {color: isDark ? THEME.textDark : THEME.textLight}]}>{slides[i].title}</Text>
        <Text style={[styles.body, {color: isDark ? THEME.textDark : THEME.textLight, textAlign:'center'}]}>{slides[i].text}</Text>

        <View style={styles.dotsRow}>
          {slides.map((_, idx)=>(
            <View key={idx} style={[styles.dot, {opacity: i===idx ? 1 : 0.3, backgroundColor: THEME.coral}]} />
          ))}
        </View>

        <View style={styles.rowBetween}>
          <TouchableOpacity
            style={[styles.secondaryBtn, {borderColor: THEME.coral}]}
            onPress={()=> setI(Math.max(0, i-1))}
            disabled={i===0}
          >
            <Text style={[styles.secondaryBtnText, {color: THEME.coral}]}>Tillbaka</Text>
          </TouchableOpacity>

          {i < slides.length - 1 ? (
            <TouchableOpacity style={[styles.primaryBtn, {backgroundColor: THEME.coral}]} onPress={()=> setI(i+1)}>
              <Text style={styles.primaryBtnText}>Nästa</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.primaryBtn, {backgroundColor: THEME.coral}]} onPress={onDone}>
              <Text style={styles.primaryBtnText}>Börja</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Text style={{marginTop:12, color: isDark?THEME.dimDark:THEME.dimLight, textAlign:'center'}}>
        Tips: Prova mörkt läge i iOS – appen följer systemet.
      </Text>
    </View>
  );
}

// ===== Settings =====
function Settings(){
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(()=>{ (async ()=>{
    // Migrera ev. settings från v1 till v2 (lägga till transferDate om saknas)
    const sV2 = await load(STORAGE_KEYS.settings);
    if (sV2) {
      setSettings({ ...DEFAULT_SETTINGS, ...sV2 });
    } else {
      // Försök läsa ev. gammal v1-nyckel
      const sV1 = await SecureStore.getItemAsync('ivf_settings_v1');
      if (sV1) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(sV1) });
    }
    setLoaded(true);
  })(); },[]);

  function update(p){ setSettings(prev=>({...prev, ...p})); }

  if(!loaded){
    return <Centered isDark={isDark}><Text style={{color:isDark?THEME.textDark:THEME.textLight}}>Laddar inställningar…</Text></Centered>;
  }

  return (
    <ScrollView style={[styles.screen, {backgroundColor: isDark ? THEME.bgDark : THEME.bgLight}]} contentContainerStyle={{paddingBottom:40}}>
      <Text style={[styles.headerTitle, {color:isDark?THEME.textDark:THEME.textLight}]}>Inställningar</Text>

      <Card isDark={isDark}>
        <Label isDark={isDark}>Startdatum (Dag 1) – ÅÅÅÅ-MM-DD</Label>
        <Input isDark={isDark} placeholder="t.ex. 2025-09-01" value={settings.startDate} onChangeText={v=>update({startDate:v})} />

        <Label isDark={isDark}>Insättningsdatum – ÅÅÅÅ-MM-DD</Label>
        <Input isDark={isDark} placeholder="t.ex. 2025-09-16" value={settings.transferDate} onChangeText={v=>update({transferDate:v})} />

        <Label isDark={isDark}>Antal behandlingsdagar</Label>
        <Input isDark={isDark} keyboardType="number-pad" value={String(settings.totalDays)} onChangeText={v=>update({totalDays: parseInt(v||'0',10)||0})} />

        <Label isDark={isDark}>Medicintider (kommaseparerat, HH:MM)</Label>
        <Input isDark={isDark} value={settings.times.join(', ')}
          onChangeText={v=>update({times: v.split(',').map(s=>s.trim()).filter(Boolean)})}
          placeholder="08:00, 14:00, 22:00" />

        <Label isDark={isDark}>Nag-tid (minuter)</Label>
        <Input isDark={isDark} keyboardType="number-pad" value={String(settings.nagMinutes)} onChangeText={v=>update({nagMinutes: parseInt(v||'0',10)||0})} />

        <RowBetween>
          <Label isDark={isDark}>Ljud</Label>
          <Switch value={settings.soundEnabled} onValueChange={val=>update({soundEnabled:val})} trackColor={{false:'#bbb', true:THEME.coral}} thumbColor="#fff" />
        </RowBetween>

        <RowBetween>
          <Label isDark={isDark}>Vibration</Label>
          <Switch value={settings.hapticsEnabled} onValueChange={val=>update({hapticsEnabled:val})} trackColor={{false:'#bbb', true:THEME.coral}} thumbColor="#fff" />
        </RowBetween>

        <TouchableOpacity style={[styles.primaryBtn, {backgroundColor:THEME.coral, alignSelf:'flex-start', marginTop:10}]}
          onPress={async ()=>{
            const bad = settings.times.some(t=>!/^\d{2}:\d{2}$/.test(t));
            if (bad) { Alert.alert('Fel format', 'Använd HH:MM, separerade med komman.'); return; }
            await save(STORAGE_KEYS.settings, settings);
            Alert.alert('Sparat', 'Inställningar sparade.');
          }}>
          <Text style={styles.primaryBtnText}>Spara</Text>
        </TouchableOpacity>
      </Card>

      <Text style={[styles.helpText, {color:isDark?THEME.dimDark:THEME.dimLight}]}>
        Notiser schemaläggs i Hem-fliken. Sätt gärna en tid 2–3 minuter fram för att testa.
      </Text>
    </ScrollView>
  );
}

// ===== Medicines =====
function Medicines(){
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [meds, setMeds] = useState(DEFAULT_MEDICINES);
  const [loaded, setLoaded] = useState(false);

  useEffect(()=>{ (async ()=>{
    const s = await load(STORAGE_KEYS.settings);
    const m = await load(STORAGE_KEYS.medicines);
    if (s) setSettings(s);
    if (m) setMeds(m);
    setLoaded(true);
  })(); },[]);

  async function persist(newMeds){
    setMeds(newMeds);
    await save(STORAGE_KEYS.medicines, newMeds);
  }

  if(!loaded){
    return <Centered isDark={isDark}><Text style={{color:isDark?THEME.textDark:THEME.textLight}}>Laddar mediciner…</Text></Centered>;
  }

  return (
    <ScrollView style={[styles.screen, {backgroundColor: isDark ? THEME.bgDark : THEME.bgLight}]} contentContainerStyle={{paddingBottom:40}}>
      <Text style={[styles.headerTitle, {color:isDark?THEME.textDark:THEME.textLight}]}>Mediciner</Text>

      {meds.map(m => (
        <Card key={m.id} isDark={isDark}>
          <View style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between'}}>
            <View style={{flexDirection:'row', alignItems:'center', gap:10}}>
              <View style={{width:32, height:32, borderRadius:16, backgroundColor:m.color, alignItems:'center', justifyContent:'center'}}>
                <Text style={{fontSize:16}}>{m.icon}</Text>
              </View>
              <View>
                <Text style={[styles.medName, {color:isDark?THEME.textDark:THEME.textLight}]}>{m.name}</Text>
                <Text style={{color:isDark?THEME.dimDark:THEME.dimLight}}>{m.dose}</Text>
              </View>
            </View>
            <View style={{flexDirection:'row', alignItems:'center', gap:8}}>
              <Text style={{color:isDark?THEME.textDark:THEME.textLight}}>{m.enabled ? 'På' : 'Av'}</Text>
              <Switch
                value={m.enabled}
                onValueChange={async (val)=>{
                  const updated = meds.map(x => x.id===m.id ? {...x, enabled: val} : x);
                  await persist(updated);
                }}
                trackColor={{false:'#bbb', true:THEME.coral}}
                thumbColor="#fff"
              />
            </View>
          </View>

          <Label isDark={isDark} style={{marginTop:12}}>Tider</Label>
          <View style={{flexDirection:'row', flexWrap:'wrap', gap:8}}>
            {settings.times.map(t => {
              const selected = m.times.includes(t);
              return (
                <TouchableOpacity key={t}
                  onPress={async ()=>{
                    let next = m.times;
                    if (selected) next = next.filter(x=>x!==t); else next = [...next, t];
                    const updated = meds.map(x => x.id===m.id ? {...x, times: next.sort()} : x);
                    await persist(updated);
                  }}
                  style={{
                    paddingVertical:8, paddingHorizontal:12, borderRadius:999,
                    backgroundColor: selected ? THEME.coral : (isDark ? THEME.chipBgDark : THEME.chipBgLight),
                    borderWidth:1, borderColor: selected ? THEME.coral : (isDark?THEME.borderDark:THEME.borderLight)
                  }}>
                  <Text style={{color: selected ? '#fff' : (isDark?THEME.textDark:THEME.textLight), fontWeight:'800'}}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>
      ))}

      <Text style={[styles.helpText, {color:isDark?THEME.dimDark:THEME.dimLight}]}>Tips: Stäng av mediciner du inte använder just nu, och välj bara tider som gäller.</Text>
    </ScrollView>
  );
}

// ===== Home + Status + Notifications + Progressbar =====
function Home(){
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [meds, setMeds] = useState(DEFAULT_MEDICINES);
  const [statusDaily, setStatusDaily] = useState({});
  const [schedules, setSchedules] = useState({});
  const [loaded, setLoaded] = useState(false);

  const today = new Date();
  const dateKey = formatDate(today);
  const day = dayNumber(settings.startDate, today);
  const total = settings.totalDays;

  useEffect(()=>{ (async ()=>{
    const s = await load(STORAGE_KEYS.settings);
    const m = await load(STORAGE_KEYS.medicines);
    const st = await load(STORAGE_KEYS.statusDaily) || {};
    const sc = await load(STORAGE_KEYS.schedules) || {};
    if (s) setSettings(s);
    if (m) setMeds(m);
    setStatusDaily(st);
    setSchedules(sc);
    setLoaded(true);

    if (Device.isDevice) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Behörighet', 'Aktivera notiser i Inställningar för att få påminnelser.');
      }
    }
  })(); },[]);

  const todaysItems = useMemo(()=>{
    const active = meds.filter(m => m.enabled);
    return active.flatMap(m => (m.times || []).map(t => ({...m, time: t}))).sort((a,b)=>a.time.localeCompare(b.time));
  }, [meds]);

  function allTaken(newStatus){
    const keys = todaysItems.map(it => `${it.id}@${it.time}`);
    if (keys.length === 0) return false;
    return keys.every(k => (newStatus[dateKey] || {})[k] === 'taken');
  }

  async function markTaken(medId, time){
    const k = `${medId}@${time}`;
    const dayObj = {...(statusDaily[dateKey] || {})};
    dayObj[k] = 'taken';
    const newStatus = {...statusDaily, [dateKey]: dayObj};
    setStatusDaily(newStatus);
    await save(STORAGE_KEYS.statusDaily, newStatus);

    // Stäng av nag för just den dosen om den finns
    const schedKey = `${dateKey}@${medId}@${time}`;
    const info = schedules[schedKey];
    try {
      if (info?.nagId) await Notifications.cancelScheduledNotificationAsync(info.nagId);
    } catch {}
    const newSchedules = {...schedules, [schedKey]: {...info, nagId: null}};
    setSchedules(newSchedules);
    await save(STORAGE_KEYS.schedules, newSchedules);

    if (allTaken(newStatus)) {
      const msg = MESSAGES[Math.floor(Math.random()*MESSAGES.length)];
      Alert.alert('Snyggt! 💪', msg);
    }
  }

  async function scheduleToday(){
    const now = new Date();
    let newSchedules = {...schedules};

    for (const it of todaysItems) {
      const mainTime = parseTimeToDate(it.time, today);
      if (mainTime <= now) mainTime.setDate(mainTime.getDate() + 1);

      const mainId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Dags för mediciner 💊',
          body: `${it.name} ${it.dose} kl ${it.time}`,
          data: { medId: it.id, time: it.time, dateKey: formatDate(mainTime) }
        },
        trigger: mainTime
      });

      const nagTime = addMinutes(mainTime, settings.nagMinutes || 15);
      const nagId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Påminnelse (nag)',
          body: `Har du tagit ${it.name} (${it.time})?`,
          data: { medId: it.id, time: it.time, dateKey: formatDate(mainTime), isNag: true }
        },
        trigger: nagTime
      });

      const key = `${formatDate(mainTime)}@${it.id}@${it.time}`;
      newSchedules[key] = { mainId, nagId };
    }

    setSchedules(newSchedules);
    await save(STORAGE_KEYS.schedules, newSchedules);
    Alert.alert('Klart', 'Dagens påminnelser är schemalagda.');
  }

  async function cancelAll(){
    try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch {}
    setSchedules({});
    await save(STORAGE_KEYS.schedules, {});
    Alert.alert('Rensat', 'Alla schemalagda notiser avbokade.');
  }

  // ===== Progress mot insättningsdag =====
  const start = parseISODateOrNull(settings.startDate);
  const transfer = parseISODateOrNull(settings.transferDate);
  let progressPct = null, daysLeft = null, totalSpanDays = null;
  if (start && transfer) {
    totalSpanDays = Math.max(1, daysBetween(start, transfer));
    const gone = daysBetween(start, today);
    const pct = clamp01(gone / totalSpanDays);
    progressPct = Math.round(pct * 100);
    daysLeft = Math.max(0, daysBetween(today, transfer));
  }

  if (!loaded){
    return <Centered isDark={isDark}><Text style={{color:isDark?THEME.textDark:THEME.textLight}}>Laddar…</Text></Centered>;
  }

  return (
    <View style={[styles.screen, {backgroundColor: isDark ? THEME.bgDark : THEME.bgLight}]}>
      <Text style={[styles.headerTitle, {color:isDark?THEME.textDark:THEME.textLight}]}>
        {settings.startDate ? `Dag ${day ?? '–'} av ${total}` : 'Välj startdatum i Inställningar'}
      </Text>
      <Text style={{color:isDark?THEME.dimDark:THEME.dimLight, marginBottom:10}}>{dateKey}</Text>

      {/* Progress mot insättningsdag */}
      {transfer ? (
        <View style={[styles.card, {backgroundColor: isDark ? THEME.cardDark : THEME.cardLight, borderColor: isDark ? THEME.borderDark : THEME.borderLight}]}>
          <Text style={[styles.medName, {color:isDark?THEME.textDark:THEME.textLight}]}>Mot insättningsdagen</Text>
          <Text style={{color:isDark?THEME.dimDark:THEME.dimLight, marginBottom:8}}>
            Insättning: {settings.transferDate}{start ? ` • Start: ${settings.startDate}` : ''}
          </Text>
          <View style={styles.progressOuter}>
            <View style={[styles.progressInner, { width: `${progressPct ?? 0}%`, backgroundColor: THEME.coral }]} />
          </View>
          <Text style={{marginTop:6, color:isDark?THEME.textDark:THEME.textLight, fontWeight:'800'}}>
            {progressPct !== null ? `${progressPct}%` : '—'}
            {daysLeft !== null ? ` • ${daysLeft} dagar kvar` : ''}
          </Text>
        </View>
      ) : (
        <View style={[styles.card, {backgroundColor: isDark ? THEME.cardDark : THEME.cardLight, borderColor: isDark ? THEME.borderDark : THEME.borderLight}]}>
          <Text style={{color:isDark?THEME.textDark:THEME.textLight}}>Ange ditt insättningsdatum i Inställningar för att se progression.</Text>
        </View>
      )}

      <View style={{flexDirection:'row', gap:8, marginBottom:10, flexWrap:'wrap'}}>
        <TouchableOpacity onPress={scheduleToday} style={[styles.primaryBtn, {backgroundColor:THEME.coral}]}>
          <Text style={styles.primaryBtnText}>Schemalägg dagens påminnelser</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={cancelAll} style={[styles.secondaryBtn, {borderColor:THEME.coral}]}>
          <Text style={[styles.secondaryBtnText, {color:THEME.coral}]}>Rensa alla</Text>
        </TouchableOpacity>
      </View>

      {todaysItems.length === 0 ? (
        <Card isDark={isDark}><Text style={{color:isDark?THEME.textDark:THEME.textLight}}>Inga mediciner aktiverade idag.</Text></Card>
      ) : (
        <FlatList
          data={todaysItems}
          keyExtractor={(it, i)=>it.id+'@'+it.time+'@'+i}
          renderItem={({item})=>{
            const taken = (statusDaily[dateKey] || {})[`${item.id}@${item.time}`] === 'taken';
            return (
              <View style={[styles.medRow, {borderColor:isDark?THEME.borderDark:THEME.borderLight}]}>
                <View style={{flexDirection:'row', alignItems:'center', gap:10, flex:1}}>
                  <View style={{width:34, height:34, borderRadius:17, backgroundColor:item.color, alignItems:'center', justifyContent:'center'}}>
                    <Text style={{fontSize:18}}>{item.icon}</Text>
                  </View>
                  <View style={{flex:1}}>
                    <Text style={[styles.medName, {color:isDark?THEME.textDark:THEME.textLight}]}>{item.name} <Text style={{color:isDark?THEME.dimDark:THEME.dimLight}}>• {item.dose}</Text></Text>
                    <Text style={{color:isDark?THEME.dimDark:THEME.dimLight}}>Tid: {item.time}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  disabled={taken}
                  onPress={()=>markTaken(item.id, item.time)}
                  style={[
                    styles.takeBtn,
                    { backgroundColor: taken ? THEME.success : THEME.coral, opacity: taken ? 0.65 : 1 }
                  ]}
                >
                  <Text style={{color:'#fff', fontWeight:'900'}}>{taken ? 'Tagen ✓' : 'Markera tagen'}</Text>
                </TouchableOpacity>
              </View>
            );
          }}
          ItemSeparatorComponent={()=> <View style={{height:10}}/>}
        />
      )}
    </View>
  );
}

// ===== UI helpers =====
function Centered({children, isDark}){ return (
  <View style={[styles.screen, {backgroundColor:isDark?THEME.bgDark:THEME.bgLight, justifyContent:'center', alignItems:'center'}]}>
    {children}
  </View>
); }
function Card({children, isDark}){ return (
  <View style={[styles.card, {backgroundColor:isDark?THEME.cardDark:THEME.cardLight, borderColor:isDark?THEME.borderDark:THEME.borderLight}]}>
    {children}
  </View>
); }
function Label({children, isDark, style}){ return <Text style={[styles.label, {color:isDark?THEME.textDark:THEME.textLight}, style]}>{children}</Text>; }
function Input(props){
  const { isDark } = props;
  return (
    <TextInput
      {...props}
      style={[styles.input, {borderColor: isDark?THEME.borderDark:THEME.borderLight, color:isDark?THEME.textDark:THEME.textLight, backgroundColor:isDark?'#121214':'#FAFAFA'}, props.style]}
      placeholderTextColor={isDark ? THEME.dimDark : '#8A8F98'}
      autoCapitalize="none"
    />
  );
}
function RowBetween({children}){ return <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:10}}>{children}</View>; }

// ===== Root (tabs) =====
export default function App(){
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const [ready, setReady] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [tab, setTab] = useState('home');

  useEffect(()=>{ (async ()=>{
    const ob = await load(STORAGE_KEYS.hasOnboarded);
    setHasOnboarded(!!ob);
    setReady(true);
  })(); },[]);

  if (!ready){
    return <Centered isDark={isDark}><Text style={{color:isDark?THEME.textDark:THEME.textLight}}>Startar…</Text></Centered>;
  }

  if (!hasOnboarded){
    return (
      <Onboarding
        onDone={async ()=>{
          await save(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
          await save(STORAGE_KEYS.medicines, DEFAULT_MEDICINES);
          await save(STORAGE_KEYS.hasOnboarded, true);
          setHasOnboarded(true);
          Alert.alert('Välkommen!', 'Standardinställningar skapade. Ändra under Inställningar/Mediciner.');
        }}
      />
    );
  }

  return (
    <View style={[styles.appRoot, {backgroundColor:isDark?THEME.bgDark:THEME.bgLight}]}>
      <View style={styles.topBar}>
        <Text style={[styles.appTitle, {color:isDark?THEME.textDark:THEME.textLight}]}>IVF Påminnare</Text>
      </View>
      <View style={styles.tabRow}>
        <TabBtn label="Hem" active={tab==='home'} onPress={()=>setTab('home')} />
        <TabBtn label="Mediciner" active={tab==='meds'} onPress={()=>setTab('meds')} />
        <TabBtn label="Inställningar" active={tab==='settings'} onPress={()=>setTab('settings')} />
      </View>
      <View style={{flex:1}}>
        {tab==='home' ? <Home/> : tab==='meds' ? <Medicines/> : <Settings/>}
      </View>
    </View>
  );
}

function TabBtn({label, active, onPress}){
  return (
    <TouchableOpacity onPress={onPress} style={[
      styles.tabBtn,
      { borderBottomColor: active ? THEME.coral : 'transparent' }
    ]}>
      <Text style={{fontWeight: active ? '900' : '700', color: active ? THEME.coral : '#8A8F98'}}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  appRoot: { flex:1, paddingTop:56, paddingHorizontal:16 },
  topBar: { marginBottom:8 },
  appTitle: { fontSize:22, fontWeight:'900' },

  screen: { flex:1, paddingTop:56, paddingHorizontal:16 },
  card: { borderWidth:1, borderRadius:18, padding:16, marginBottom:12 },
  slideTitle: { fontSize:20, fontWeight:'800', marginBottom:8, textAlign:'center' },
  body: { fontSize:16, lineHeight:22 },
  dotsRow: { flexDirection:'row', gap:8, justifyContent:'center', marginTop:10, marginBottom:14 },
  dot: { width:8, height:8, borderRadius:4 },
  rowBetween: { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },

  headerTitle: { fontSize:20, fontWeight:'900', marginBottom:6 },
  label: { fontSize:15, fontWeight:'700', marginTop:12, marginBottom:6 },
  input: { borderWidth:1, borderRadius:12, padding:12 },

  medName: { fontSize:16, fontWeight:'800' },
  medRow: { flexDirection:'row', alignItems:'center', padding:12, borderRadius:14, borderWidth:1, backgroundColor:'transparent' },
  takeBtn: { paddingVertical:10, paddingHorizontal:12, borderRadius:12 },

  tabRow: { flexDirection:'row', gap:2, borderBottomWidth:1, borderColor:'#EAEAEA', marginBottom:8 },
  tabBtn: { paddingVertical:12, paddingHorizontal:16, borderBottomWidth:2 },

  primaryBtn: { paddingVertical:12, paddingHorizontal:16, borderRadius:12 },
  primaryBtnText: { color:'#fff', fontWeight:'900' },
  secondaryBtn: { paddingVertical:10, paddingHorizontal:16, borderRadius:12, borderWidth:1, backgroundColor:'transparent' },
  secondaryBtnText: { fontWeight:'800' },

  helpText: { marginTop:10, fontSize:13 },

  // Progress bar
  progressOuter: { height:12, borderRadius:999, backgroundColor:'#EDEDED', overflow:'hidden' },
  progressInner: { height:'100%' }
});

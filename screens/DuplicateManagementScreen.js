/**
 * @module screens/DuplicateManagementScreen
 * Container screen for duplicate report management of an authenticated staff session (403 shown as
 * `forbidden`): groups candidate reports, selects reports and a canonical one with a note to resolve
 * a duplicate group, and reverses active groups. Confirms before discarding unsaved selections.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, ActivityIndicator, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDuplicateResolution } from '../hooks/useDuplicateResolution.js';
import { AppButton, AppTextField, Banner, Chip, Icon, Pager, Sheet, StateView } from '../components/ui/index.js';
import { colors, fontFamily, layout, radius, spacing, type } from '../theme/index.js';
/** Suggestions and active groups shown per page. */
const PAGE_SIZE=3;
/** Width of a comparison card; the strip snaps to it. */
const CARD_WIDTH=216;
/** Last six characters of an id, used as a short label. */
const short=(id)=>id.slice(-6);
/** Translates a validation error (`{key, values}`) or returns a string error as is. */
const errorText=(error,t)=>typeof error==='string'?error:error?t(`duplicates.validation.${error.key}`,error.values):'';
/** Candidate report as a comparable card: checkbox on top, the same facts in the same place, canonical pill at the bottom. */
function ReportCard({report,selected,canonical,disabled,onToggle,onCanonical,t}) {
  const [open,setOpen]=useState(false);
  const label=t('duplicates.report',{id:short(report.id)});
  const kind=[report.incident_type,report.sighting_type].filter(Boolean).map((value)=>value.replaceAll('_',' ')).join(' · ');
  const dogLine=report.dog?[report.dog.predominant_color,report.dog.size].filter(Boolean).join(' · '):'';
  return <View style={[styles.card,selected&&styles.cardSelected]}>
    <Pressable testID={`duplicate-select-${report.id}`} accessibilityRole="checkbox" accessibilityLabel={t('duplicates.select',{report:label})}
      aria-checked={selected} accessibilityState={{checked:selected,disabled}} disabled={disabled} onPress={onToggle} style={styles.cardHead}>
      <View style={[styles.box,selected&&styles.boxOn]}>{selected?<Icon name="check" size={16} color={colors.onPrimary} strokeWidth={3}/>:null}</View>
      <View style={styles.cardTitle}><Text style={styles.label}>{label}</Text><Chip label={t(`moderation.status.${report.status}`)} tone={report.status==='hidden'?'warning':'neutral'}/></View>
    </Pressable>
    <View style={styles.facts}>
      {kind?<Text style={styles.kind}>{kind}</Text>:null}
      {dogLine?<Text style={styles.fact}>{dogLine}</Text>:null}
      {report.client_created_at?<Text style={styles.caption}>{t('duplicates.observed')}: {new Date(report.client_created_at).toLocaleString()}</Text>:null}
    </View>
    <Pressable accessibilityRole="button" accessibilityState={{expanded:open}} onPress={()=>setOpen((value)=>!value)} hitSlop={6} style={styles.detailToggle}>
      <Text style={styles.detailToggleText}>{t(open?'duplicates.hideDetails':'duplicates.showDetails')}</Text><Icon name="down" size={16} color={colors.primary}/>
    </Pressable>
    <View style={[styles.details,!open&&styles.hidden]}>
      <Text selectable style={styles.caption}>ID: {report.id}</Text>
      {report.dog&&typeof report.dog.has_collar==='boolean'?<Text style={styles.caption}>{t('duplicates.collar')}: {t(report.dog.has_collar?'common.yes':'common.no')}</Text>:null}
      {report.location?<Text selectable style={styles.caption}>{t('moderation.exactLocation')}: {report.location.latitude}, {report.location.longitude}</Text>:null}
      {report.details?Object.entries(report.details).map(([key,value])=><Text key={key} style={styles.caption}>{key.replaceAll('_',' ')}: {typeof value==='object'?JSON.stringify(value):String(value)}</Text>):null}
    </View>
    {selected&&!canonical?<Text style={styles.caption}>{t('duplicates.willBeDuplicate')}</Text>:null}
    <View style={styles.spacer}/>
    <Pressable testID={`duplicate-canonical-${report.id}`} accessibilityRole="radio" accessibilityLabel={t('duplicates.chooseCanonical',{report:label})}
      aria-checked={canonical} accessibilityState={{checked:canonical,disabled:disabled||!selected}} disabled={disabled||!selected} onPress={onCanonical} style={[styles.canonicalHit,canonical&&styles.canonicalChosenHit,(!selected||disabled)&&styles.dim]}>
      <View style={[styles.radio,canonical&&styles.radioOn]}>{canonical?<View style={styles.radioDot}/>:null}</View>
      <Text style={[styles.canonicalText,canonical&&styles.canonicalTextOn]}>{t('duplicates.canonicalShort')}</Text>
    </Pressable>
  </View>;
}
/** System-suggested connections between reports: one summary line that unfolds into an aligned table, nearest first. */
function LinkList({edges,t}) {
  const [open,setOpen]=useState(false);
  if(!edges.length)return null;
  const sorted=[...edges].sort((x,y)=>(x.distance_meters??Infinity)-(y.distance_meters??Infinity));
  const max=(key)=>Math.max(0,...edges.map((edge)=>Number.isFinite(edge[key])?edge[key]:0));
  return <View style={styles.links}>
    <Pressable accessibilityRole="button" accessibilityState={{expanded:open}} accessibilityLabel={`${t('duplicates.links')}: ${t('duplicates.linksSummary',{count:edges.length,meters:max('distance_meters').toFixed(1),minutes:max('minutes_apart').toFixed(1)})}`}
      onPress={()=>setOpen((value)=>!value)} style={styles.linksHead}>
      <View style={styles.linksText}>
        <Text style={styles.linksTitle}>{t('duplicates.links')}</Text>
        <Text style={styles.linksSummary}>{t('duplicates.linksSummary',{count:edges.length,meters:max('distance_meters').toFixed(1),minutes:max('minutes_apart').toFixed(1)})}</Text>
      </View>
      <Icon name={open?'up':'down'} size={20} color={colors.primary}/>
    </Pressable>
    <View style={[styles.linksBody,!open&&styles.hidden]}>
      {sorted.map((edge,i)=><View key={edge.id} style={[styles.linkRow,i>0&&styles.linkRowDivider]}>
        <Text style={styles.linkPair}>{short(edge.report_a)} ↔ {short(edge.report_b)}</Text>
        <Text style={styles.linkValue}>{Number.isFinite(edge.distance_meters)?`${edge.distance_meters.toFixed(1)} m`:''}</Text>
        <Text style={styles.linkValue}>{Number.isFinite(edge.minutes_apart)?`${edge.minutes_apart.toFixed(1)} min`:''}</Text>
      </View>)}
    </View>
  </View>;
}
function Note({value,onChange,label,error,disabled,t,inputRef,testID,tone}) {
  return <AppTextField tone={tone} ref={inputRef} testID={testID} label={label} accessibilityHint={errorText(error,t)} aria-invalid={Boolean(error)}
    value={value} onChangeText={onChange} editable={!disabled} multiline error={errorText(error,t)||undefined} helper={t('duplicates.noteHint')}/>;
}
/**
 * @param {object} props
 * @param {string} props.accessToken - Session access token.
 * @param {() => void} [props.onBack]
 * @param {object} [props.api] - Network call overrides for `useDuplicateResolution`.
 * @returns {JSX.Element}
 */
export default function DuplicateManagementScreen({accessToken,onBack,api}) {
  const {t}=useTranslation();
  const form=useDuplicateResolution(accessToken,api);
  const [navigation,setNavigation]=useState(null);
  const [suggestionPage,setSuggestionPage]=useState(0), [groupPage,setGroupPage]=useState(0);
  const scroll=useRef(null), summaryY=useRef(0), bodyY=useRef(0), reason=useRef(null);
  const busy=Boolean(form.busy), disabled=busy||form.needsReload;
  function navigate(action) {
    if(busy)return;
    if(form.dirty&&!form.needsReload)setNavigation(action);
    else if(action==='back')onBack?.();else form.reload();
  }
  useEffect(()=>{setNavigation(null);},[accessToken]);
  useEffect(()=>{
    if(Platform.OS!=='android')return;
    const handler=BackHandler.addEventListener('hardwareBackPress',()=>{
      if(form.reverseId)form.closeReverse();else navigate('back');return true;
    });
    return ()=>handler.remove();
  },[busy,form.reverseId,form.dirty,form.needsReload,onBack]);
  useEffect(()=>{
    const first=Object.values(form.errors)[0];
    if(!first)return;
    if(form.reverseId)reason.current?.focus();else scroll.current?.scrollTo({y:Math.max(0,summaryY.current+bodyY.current-16),animated:true});
    AccessibilityInfo.announceForAccessibility(errorText(first,t));
  },[form.errors,t]);
  useEffect(()=>{
    if(!form.notice)return;
    scroll.current?.scrollTo({y:0,animated:true});
    AccessibilityInfo.announceForAccessibility(t(`duplicates.success.${form.notice.kind}`));
  },[form.notice,t]);
  const selectionError=form.errors.report_ids??form.selectionError;
  const generalError=form.error?t(`duplicates.errors.${form.error.code}`,{defaultValue:t('duplicates.errors.request_failed')}):'';
  const reverseGroup=form.groups.find((g)=>g.id===form.reverseId);
  const ready=form.phase==='ready';
  const suggestionPages=Math.max(1,Math.ceil(form.components.length/PAGE_SIZE)), groupPages=Math.max(1,Math.ceil(form.groups.length/PAGE_SIZE));
  const currentSuggestionPage=Math.min(suggestionPage,suggestionPages-1), currentGroupPage=Math.min(groupPage,groupPages-1);
  const pageLabel=(page,total)=>t('duplicates.pageOf',{page:page+1,total});
  return <SafeAreaView style={styles.safe} edges={['top','bottom','left','right']}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView ref={scroll} style={styles.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View pointerEvents="none" accessible={false} aria-hidden importantForAccessibility="no" style={styles.bigPaw}><Icon name="dog" size={210} color={colors.onPrimary} strokeWidth={1.4}/></View>
          <View style={styles.headerInner}>
            <View style={styles.topActions}>
              {onBack?<Pressable accessibilityRole="button" disabled={busy} onPress={()=>navigate('back')} hitSlop={8} style={styles.back}>
                <Icon name="back" size={20} color={colors.onPrimary}/><Text style={styles.backText}>{t('configuration.back')}</Text>
              </Pressable>:<View/>}
              {ready?<Pressable accessibilityRole="button" accessibilityLabel={t(form.needsReload?'duplicates.verify':'duplicates.refresh')} accessibilityState={{disabled:busy}} disabled={busy} onPress={()=>navigate('reload')} hitSlop={4} style={({pressed})=>[styles.refresh,form.needsReload&&styles.refreshAlert,pressed&&styles.pressed,busy&&styles.dim]}>
                <Icon name="refresh" size={22} color={form.needsReload?colors.forestDeep:colors.onPrimary}/>
              </Pressable>:null}
            </View>
            <Text accessibilityRole="header" style={styles.title}>{t('duplicates.title')}</Text>
            <Text style={styles.subtitle}>{t('duplicates.subtitle')}</Text>
          </View>
        </View>
        <View style={styles.body} onLayout={(event)=>{bodyY.current=event.nativeEvent.layout.y;}}>
          {form.phase==='loading'?<StateView kind="loading" title={t('duplicates.loading')}/>:null}
          {['session','forbidden'].includes(form.phase)?<StateView kind="empty" title={t(form.phase==='session'?'configuration.sessionTitle':'configuration.forbiddenTitle')} message={t(form.phase==='session'?'configuration.sessionBody':'configuration.forbiddenBody')}/>:null}
          {form.phase==='error'?<StateView kind="error" title={generalError}><AppButton title={t('configuration.retry')} variant="secondary" onPress={form.reload}/></StateView>:null}
          {ready?<>
            {form.notice?<Banner tone="success" message={t(`duplicates.success.${form.notice.kind}`)}><Text selectable style={styles.caption}>ID: {form.notice.groupId}</Text></Banner>:null}
            {form.error&&!form.reverseId?<Banner tone="error" message={generalError}>
              {form.needsReload?<Text style={styles.bodyText}>{t(form.notice?'duplicates.refreshAfterSuccess':'duplicates.uncertain')}</Text>:null}
              {form.error.requestId?<Text selectable style={styles.caption}>{t('zoneSets.requestId')}: {form.error.requestId}</Text>:null}
            </Banner>:null}
            <View style={styles.sectionHeader}><Text accessibilityRole="header" style={styles.sectionTitle}>{t('duplicates.pending')}</Text><Text style={styles.count}>{form.components.length}</Text></View>
            {!form.components.length?<Text style={styles.bodyText}>{t('duplicates.empty')}</Text>:<Text style={styles.caption}>{t('duplicates.canonicalLegend')}</Text>}
            {form.components.slice(currentSuggestionPage*PAGE_SIZE,(currentSuggestionPage+1)*PAGE_SIZE).map((component,sliceIndex)=>{const index=currentSuggestionPage*PAGE_SIZE+sliceIndex;return <View key={component.id} style={styles.group}>
              <Text accessibilityRole="header" style={styles.groupTitle}>{t('duplicates.component',{number:index+1,count:component.reports.length})}</Text>
              <ScrollView horizontal style={styles.bleed} showsHorizontalScrollIndicator={false} snapToInterval={CARD_WIDTH+spacing.md} decelerationRate="fast" contentContainerStyle={styles.strip}>
                {component.reports.map((report)=><ReportCard key={report.id} report={report} selected={form.ids.includes(report.id)} canonical={form.canonicalId===report.id}
                  disabled={disabled} onToggle={()=>form.toggleReport(report.id)} onCanonical={()=>form.chooseCanonical(report.id)} t={t}/>)}
              </ScrollView>
              <LinkList t={t} edges={form.snapshot.candidates.filter((edge)=>component.reports.some((r)=>r.id===edge.report_a)&&component.reports.some((r)=>r.id===edge.report_b))}/>
            </View>;})}
            <Pager page={currentSuggestionPage} pageCount={suggestionPages} onChange={setSuggestionPage} previousLabel={t('duplicates.pagePrev')} nextLabel={t('duplicates.pageNext')} pageLabel={pageLabel(currentSuggestionPage,suggestionPages)}/>
            <View testID="duplicate-selection-summary" onLayout={(event)=>{summaryY.current=event.nativeEvent.layout.y;}} style={styles.decision}>
              <Text accessibilityRole="header" style={styles.decisionTitle}>{t('duplicates.selection',{count:form.ids.length})}</Text>
              <Text style={styles.decisionText}>{form.canonicalId?t('duplicates.canonicalSummary',{id:short(form.canonicalId)}):t('duplicates.chooseHelp')}</Text>
              {selectionError?<Text testID="duplicate-graph-error" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.darkError}>{errorText(selectionError,t)}</Text>:null}
              {form.errors.canonical_report_id?<Text accessibilityRole="alert" style={styles.darkError}>{errorText(form.errors.canonical_report_id,t)}</Text>:null}
              <Note tone="dark" testID="duplicate-resolution-note" label={t('duplicates.note')} value={form.note} onChange={form.changeNote} disabled={disabled} error={form.reverseId?null:form.errors.note} t={t}/>
              <Text style={styles.decisionText}>{t('duplicates.preserve')}</Text>
              <AppButton testID="duplicate-resolve" variant="signal" size="lg" title={t('duplicates.resolve')} disabled={disabled} onPress={form.resolve}/>
            </View>
            <View style={styles.sectionHeader}><Text accessibilityRole="header" style={styles.sectionTitle}>{t('duplicates.active')}</Text><Text style={styles.count}>{form.groups.length}</Text></View>
            {!form.groups.length?<Text style={styles.bodyText}>{t('duplicates.noActive')}</Text>:null}
            {form.groups.slice(currentGroupPage*PAGE_SIZE,(currentGroupPage+1)*PAGE_SIZE).map((group)=><View key={group.id} testID={`duplicate-group-${group.id}`} style={styles.list}>
              <View style={[styles.row,styles.rowDivider]}>
                <Text style={styles.label}>{t('duplicates.canonicalSummary',{id:short(group.canonical_report_id)})}</Text>
                <Text selectable style={styles.caption}>ID: {group.id}</Text>
                <Text style={styles.kind}>{t('duplicates.members')}</Text>
                {group.report_ids.map((id)=><Text key={id} selectable style={styles.caption}>{id}{id===group.canonical_report_id?` · ${t('duplicates.canonicalChosen')}`:''}</Text>)}
                <Text style={styles.caption}>{t('duplicates.resolutionVersion',{version:group.resolution_version})}</Text>
              </View>
              <View style={styles.row}><AppButton variant="destructive" testID={`duplicate-reverse-${group.id}`} title={t('duplicates.reverse')} onPress={()=>form.openReverse(group.id)} disabled={disabled}/></View>
            </View>)}
            <Pager page={currentGroupPage} pageCount={groupPages} onChange={setGroupPage} previousLabel={t('duplicates.pagePrev')} nextLabel={t('duplicates.pageNext')} pageLabel={pageLabel(currentGroupPage,groupPages)}/>
          </>:null}
        </View>
      </ScrollView>
      {ready && form.ids.length > 0 && !busy ? <View style={styles.selectionFooter}>
        {form.selectionError ? <Text accessibilityRole="alert" style={styles.onGreenError}>{t('duplicates.selectionWarning')}</Text> : null}
        <AppButton variant="secondary" title={t('duplicates.reviewSelection',{count:form.ids.length})} onPress={()=>scroll.current?.scrollTo({y:Math.max(0,summaryY.current+bodyY.current),animated:true})}/>
      </View> : null}
      {busy?<View style={styles.progress} accessibilityLiveRegion="polite"><ActivityIndicator color={colors.signal}/><Text style={styles.progressText}>{t(`duplicates.busy.${form.busy}`)}</Text></View>:null}
    </KeyboardAvoidingView>
    {reverseGroup?<Sheet keyboardAware onClose={form.closeReverse} dismissable={!busy} maxHeight="90%">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
        <Text accessibilityRole="header" style={styles.sheetTitle}>{t('duplicates.reverse')}</Text>
        <Text style={styles.bodyText}>{t('duplicates.reverseHelp')}</Text>
        <Text selectable style={styles.caption}>ID: {reverseGroup.id}</Text>
        {form.error?<Text accessibilityRole="alert" style={styles.errorText}>{generalError}</Text>:null}
        <Note inputRef={reason} testID="duplicate-reverse-note" value={form.reverseNote} onChange={form.changeReverseNote} label={t('duplicates.reverseNote')} error={form.errors.note} disabled={disabled} t={t}/>
        <AppButton testID="duplicate-confirm-reverse" title={t('duplicates.confirmReverse')} disabled={disabled} onPress={form.reverse}/>
        <AppButton variant="secondary" title={t('common.cancel')} disabled={busy} onPress={form.closeReverse}/>
      </ScrollView>
    </Sheet>:null}
    {navigation?<Sheet onClose={()=>setNavigation(null)} maxHeight="70%">
      <Text accessibilityRole="header" style={styles.sheetTitle}>{t('duplicates.discardTitle')}</Text><Text style={styles.bodyText}>{t('duplicates.discardBody')}</Text>
      <View style={styles.sheetActions}>
        <AppButton variant="secondary" title={t('configuration.keepEditing')} onPress={()=>setNavigation(null)}/>
        <AppButton title={t('configuration.discard')} onPress={()=>{const action=navigation;setNavigation(null);if(action==='back')onBack?.();else form.reload();}}/>
      </View>
    </Sheet>:null}
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  flex:{flex:1},safe:{flex:1,backgroundColor:colors.primary},scroll:{backgroundColor:colors.background},content:{flexGrow:1},
  header:{backgroundColor:colors.primary,overflow:'hidden'},bigPaw:{position:'absolute',right:-44,top:40,opacity:0.1,transform:[{rotate:'-18deg'}]},
  headerInner:{width:'100%',maxWidth:920,alignSelf:'center',paddingHorizontal:layout.margin,paddingTop:spacing.xs,paddingBottom:spacing.xxl,gap:spacing.sm},
  topActions:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  back:{flexDirection:'row',alignItems:'center',gap:spacing.xs,minHeight:layout.minTouch},backText:{...type.button,fontSize:15,color:colors.onPrimary},
  refresh:{width:layout.minTouch,height:layout.minTouch,borderRadius:12,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'rgba(201,230,196,0.45)'},
  refreshAlert:{backgroundColor:colors.signal,borderColor:colors.signal},
  title:{fontFamily:fontFamily.display,fontSize:38,lineHeight:46,letterSpacing:-0.4,color:colors.onPrimary,marginTop:spacing.md},
  subtitle:{...type.body,fontSize:15,lineHeight:22,color:colors.onForest,maxWidth:520},
  body:{width:'100%',maxWidth:920,alignSelf:'center',paddingHorizontal:layout.margin,paddingTop:spacing.xxl,paddingBottom:spacing.xxxl,gap:spacing.xl},
  sectionHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:spacing.md},
  sectionTitle:{fontFamily:fontFamily.display,fontSize:26,lineHeight:32,color:colors.primary,flexShrink:1},
  count:{fontFamily:fontFamily.number,fontVariant:['tabular-nums'],fontSize:22,color:colors.primary,backgroundColor:colors.primarySoft,borderRadius:radius.pill,minWidth:44,textAlign:'center',paddingHorizontal:spacing.md,paddingVertical:spacing.xs},
  group:{gap:spacing.md},groupTitle:{fontFamily:fontFamily.displayMedium,fontSize:20,lineHeight:26,color:colors.ink},
  list:{backgroundColor:colors.surface,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,overflow:'hidden'},
  row:{padding:spacing.lg,gap:spacing.xs},rowDivider:{borderBottomWidth:1,borderBottomColor:colors.border},
  bleed:{marginHorizontal:-layout.margin},strip:{gap:spacing.md,paddingHorizontal:layout.margin,paddingBottom:spacing.xs},
  card:{width:CARD_WIDTH,backgroundColor:colors.surface,borderRadius:radius.lg,borderWidth:2,borderColor:colors.border,padding:spacing.lg,gap:spacing.sm},
  cardSelected:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  cardHead:{flexDirection:'row',alignItems:'center',gap:spacing.md,minHeight:layout.minTouch},cardTitle:{flex:1,gap:spacing.xs,alignItems:'flex-start'},
  facts:{gap:2},fact:{fontFamily:fontFamily.labelMedium,fontSize:14,lineHeight:20,color:colors.ink},spacer:{flexGrow:1},
  detailToggle:{flexDirection:'row',alignItems:'center',gap:spacing.xs,minHeight:32,alignSelf:'flex-start'},detailToggleText:{fontFamily:fontFamily.label,fontSize:13,color:colors.primary},details:{gap:2},hidden:{display:'none'},
  box:{width:26,height:26,borderRadius:6,borderWidth:2,borderColor:colors.outline,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center'},boxOn:{backgroundColor:colors.primary,borderColor:colors.primary},
  label:{fontFamily:fontFamily.label,fontSize:15,lineHeight:22,color:colors.ink,flexShrink:1},kind:{fontFamily:fontFamily.label,fontSize:14,lineHeight:20,color:colors.ink},
  caption:{...type.caption,color:colors.inkMuted},bodyText:{...type.body,fontSize:15,lineHeight:22,color:colors.inkMuted},
  canonicalHit:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:spacing.sm,minHeight:layout.minTouch,borderRadius:radius.pill,borderWidth:1,borderColor:colors.outline,backgroundColor:colors.surface},canonicalChosenHit:{backgroundColor:colors.primary,borderColor:colors.primary},
  radio:{width:24,height:24,borderRadius:12,borderWidth:2,borderColor:colors.outline,alignItems:'center',justifyContent:'center',backgroundColor:colors.surface},radioOn:{borderColor:colors.onPrimary,backgroundColor:colors.primary},radioDot:{width:12,height:12,borderRadius:6,backgroundColor:colors.onPrimary},
  canonicalText:{fontFamily:fontFamily.label,fontSize:14,color:colors.primary},canonicalTextOn:{color:colors.onPrimary},dim:{opacity:0.5},pressed:{opacity:0.7},
  links:{backgroundColor:colors.surface,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,overflow:'hidden'},
  linksHead:{flexDirection:'row',alignItems:'center',gap:spacing.md,padding:spacing.lg,minHeight:layout.minTouch},linksText:{flex:1,gap:2},
  linksTitle:{fontFamily:fontFamily.label,fontSize:14,color:colors.ink},linksSummary:{fontFamily:fontFamily.labelMedium,fontVariant:['tabular-nums'],fontSize:13,lineHeight:19,color:colors.inkMuted},
  linksBody:{borderTopWidth:1,borderTopColor:colors.border,paddingHorizontal:spacing.lg},
  linkRow:{flexDirection:'row',alignItems:'center',gap:spacing.md,paddingVertical:spacing.md},linkRowDivider:{borderTopWidth:1,borderTopColor:colors.border},
  linkPair:{flex:1,fontFamily:fontFamily.labelMedium,fontVariant:['tabular-nums'],fontSize:13,color:colors.ink},linkValue:{minWidth:64,textAlign:'right',fontFamily:fontFamily.labelMedium,fontVariant:['tabular-nums'],fontSize:13,color:colors.primary},
  decision:{backgroundColor:colors.primary,borderRadius:radius.lg,padding:spacing.xl,gap:spacing.lg},
  decisionTitle:{fontFamily:fontFamily.display,fontSize:26,lineHeight:32,color:colors.onPrimary},decisionText:{...type.body,fontSize:14,lineHeight:21,color:colors.onForest},
  darkError:{...type.caption,fontSize:14,color:'#ffb4ab'},errorText:{...type.caption,fontSize:13,color:colors.danger},onGreenError:{...type.caption,fontSize:13,color:'#ffb4ab'},
  selectionFooter:{paddingHorizontal:spacing.lg,paddingVertical:spacing.md,gap:spacing.sm,backgroundColor:colors.primary},
  progress:{flexDirection:'row',gap:spacing.md,padding:spacing.md,justifyContent:'center',alignItems:'center',backgroundColor:colors.forestDeep},progressText:{...type.caption,color:colors.onForest},
  sheetContent:{gap:spacing.lg,paddingBottom:spacing.sm},sheetTitle:{fontFamily:fontFamily.display,fontSize:26,lineHeight:32,color:colors.ink},sheetActions:{gap:spacing.md,marginTop:spacing.sm},
});

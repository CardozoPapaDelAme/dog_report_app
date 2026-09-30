import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, ActivityIndicator, BackHandler, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDuplicateResolution } from '../hooks/useDuplicateResolution.js';
const colors={background:'#f7fbf1',primary:'#00450d',soft:'#d9f2d4',ink:'#191d17',muted:'#5d6859',border:'#c0c9bb',danger:'#a51e1e'};
const short=(id)=>id.slice(-6);
const errorText=(error,t)=>typeof error==='string'?error:error?t(`duplicates.validation.${error.key}`,error.values):'';
function Button({title,onPress,disabled=false,secondary=false,testID}) {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
    style={({pressed})=>[styles.button,secondary&&styles.secondary,disabled&&styles.disabled,pressed&&styles.pressed]}>
    <Text style={[styles.buttonText,secondary&&styles.secondaryText]}>{title}</Text>
  </Pressable>;
}
function ReportCard({report,selected,canonical,disabled,onToggle,onCanonical,t}) {
  const label=t('duplicates.report',{id:short(report.id)});
  return <View style={[styles.report,selected&&styles.selected]}>
    <Pressable testID={`duplicate-select-${report.id}`} accessibilityRole="checkbox" accessibilityLabel={t('duplicates.select',{report:label})}
      aria-checked={selected} accessibilityState={{checked:selected,disabled}} disabled={disabled} onPress={onToggle} style={styles.selection}>
      <Text style={styles.marker}>{selected?'☑':'☐'}</Text><Text style={styles.label}>{label}</Text>
      <Text style={styles.caption}>{t(`moderation.status.${report.status}`)}</Text>
    </Pressable>
    <Text selectable style={styles.caption}>ID: {report.id}</Text>
    <Text style={styles.body}>{[report.incident_type,report.sighting_type].filter(Boolean).map((value)=>value.replaceAll('_',' ')).join(' · ')}</Text>
    {report.client_created_at ? <Text style={styles.caption}>{t('duplicates.observed')}: {new Date(report.client_created_at).toLocaleString()}</Text> : null}
    {report.dog ? <Text style={styles.caption}>{t('duplicates.dog')}: {[report.dog.predominant_color,report.dog.size].filter(Boolean).join(' · ')}{typeof report.dog.has_collar==='boolean'?` · ${t('duplicates.collar')}: ${t(report.dog.has_collar?'common.yes':'common.no')}`:''}</Text> : null}
    {report.location ? <Text selectable style={styles.caption}>{t('moderation.exactLocation')}: {report.location.latitude}, {report.location.longitude}</Text> : null}
    {report.details ? Object.entries(report.details).map(([key,value])=><Text key={key} style={styles.caption}>{key.replaceAll('_',' ')}: {typeof value==='object'?JSON.stringify(value):String(value)}</Text>) : null}
    <Pressable testID={`duplicate-canonical-${report.id}`} accessibilityRole="radio" accessibilityLabel={t('duplicates.chooseCanonical',{report:label})}
      aria-checked={canonical} accessibilityState={{checked:canonical,disabled:disabled||!selected}} disabled={disabled||!selected} onPress={onCanonical} style={[styles.canonical,(!selected||disabled)&&styles.disabled]}>
      <Text style={styles.canonicalText}>{canonical?'●':'○'} {t(canonical?'duplicates.canonicalChosen':'duplicates.canonicalOption')}</Text>
    </Pressable>
    {selected&&!canonical ? <Text style={styles.caption}>{t('duplicates.willBeDuplicate')}</Text> : null}
  </View>;
}
function Note({value,onChange,label,error,disabled,t,inputRef,testID}) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text>
    <TextInput ref={inputRef} testID={testID} accessibilityLabel={label} accessibilityHint={errorText(error,t)} aria-invalid={Boolean(error)}
      value={value} onChangeText={onChange} editable={!disabled} multiline textAlignVertical="top" style={[styles.input,error&&styles.inputError]} />
    <Text style={error?styles.errorText:styles.caption}>{errorText(error,t)||t('duplicates.noteHint')}</Text>
  </View>;
}
export default function DuplicateManagementScreen({accessToken,onBack,api}) {
  const {t}=useTranslation();
  const form=useDuplicateResolution(accessToken,api);
  const [navigation,setNavigation]=useState(null);
  const scroll=useRef(null), summaryY=useRef(0), reason=useRef(null);
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
    if(form.reverseId)reason.current?.focus();else scroll.current?.scrollTo({y:Math.max(0,summaryY.current-16),animated:true});
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
  return <SafeAreaView style={styles.safe} edges={['top','bottom','left','right']}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {onBack?<Button secondary title={`← ${t('configuration.back')}`} onPress={()=>navigate('back')} disabled={busy}/>:null}
        <View style={styles.hero}><Text style={styles.eyebrow}>{t('configuration.eyebrow')}</Text>
          <Text accessibilityRole="header" style={styles.title}>{t('duplicates.title')}</Text>
          <Text style={styles.body}>{t('duplicates.subtitle')}</Text>
        </View>
        {form.phase==='loading'?<View style={styles.card}><ActivityIndicator color={colors.primary}/><Text style={styles.body}>{t('duplicates.loading')}</Text></View>:null}
        {['session','forbidden'].includes(form.phase)?<View style={styles.card} accessibilityRole="alert"><Text style={styles.heading}>{t(form.phase==='session'?'configuration.sessionTitle':'configuration.forbiddenTitle')}</Text><Text style={styles.body}>{t(form.phase==='session'?'configuration.sessionBody':'configuration.forbiddenBody')}</Text></View>:null}
        {form.phase==='error'?<View style={styles.errorBanner} accessibilityRole="alert"><Text style={styles.errorText}>{generalError}</Text><Button title={t('configuration.retry')} onPress={form.reload}/></View>:null}
        {ready?<>
          {form.notice?<View style={styles.success} accessibilityRole="alert"><Text style={styles.label}>{t(`duplicates.success.${form.notice.kind}`)}</Text><Text selectable style={styles.caption}>ID: {form.notice.groupId}</Text></View>:null}
          {form.error&&!form.reverseId?<View style={styles.errorBanner} accessibilityRole="alert"><Text style={styles.errorText}>{generalError}</Text>
            {form.needsReload?<Text style={styles.body}>{t(form.notice?'duplicates.refreshAfterSuccess':'duplicates.uncertain')}</Text>:null}
            {form.error.requestId?<Text selectable style={styles.caption}>{t('zoneSets.requestId')}: {form.error.requestId}</Text>:null}
          </View>:null}
          <Button secondary title={t(form.needsReload?'duplicates.verify':'duplicates.refresh')} disabled={busy} onPress={()=>navigate('reload')}/>
          <View style={styles.sectionHeader}><Text accessibilityRole="header" style={styles.heading}>{t('duplicates.pending')}</Text><Text style={styles.badge}>{form.components.length}</Text></View>
          {!form.components.length?<View style={styles.card}><Text style={styles.body}>{t('duplicates.empty')}</Text></View>:null}
          {form.components.map((component,index)=><View key={component.id} style={styles.card}>
            <Text accessibilityRole="header" style={styles.heading}>{t('duplicates.component',{number:index+1,count:component.reports.length})}</Text>
            {component.reports.map((report)=><ReportCard key={report.id} report={report} selected={form.ids.includes(report.id)} canonical={form.canonicalId===report.id}
              disabled={disabled} onToggle={()=>form.toggleReport(report.id)} onCanonical={()=>form.chooseCanonical(report.id)} t={t}/>)}
            <Text style={styles.label}>{t('duplicates.links')}</Text>
            {form.snapshot.candidates.filter((edge)=>component.reports.some((r)=>r.id===edge.report_a)&&component.reports.some((r)=>r.id===edge.report_b)).map((edge)=><Text key={edge.id} style={styles.caption}>
              {short(edge.report_a)} ↔ {short(edge.report_b)}{Number.isFinite(edge.distance_meters)?` · ${edge.distance_meters.toFixed(1)} m`:''}{Number.isFinite(edge.minutes_apart)?` · ${edge.minutes_apart.toFixed(1)} min`:''}
            </Text>)}
          </View>)}
          <View testID="duplicate-selection-summary" onLayout={(event)=>{summaryY.current=event.nativeEvent.layout.y;}} style={styles.card}>
            <Text accessibilityRole="header" style={styles.heading}>{t('duplicates.selection',{count:form.ids.length})}</Text>
            <Text style={styles.body}>{form.canonicalId?t('duplicates.canonicalSummary',{id:short(form.canonicalId)}):t('duplicates.chooseHelp')}</Text>
            {selectionError?<Text testID="duplicate-graph-error" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.errorText}>{errorText(selectionError,t)}</Text>:null}
            {form.errors.canonical_report_id?<Text accessibilityRole="alert" style={styles.errorText}>{errorText(form.errors.canonical_report_id,t)}</Text>:null}
            <Note testID="duplicate-resolution-note" label={t('duplicates.note')} value={form.note} onChange={form.changeNote} disabled={disabled} error={form.reverseId?null:form.errors.note} t={t}/>
            <Text style={styles.caption}>{t('duplicates.preserve')}</Text>
            <Button testID="duplicate-resolve" title={t('duplicates.resolve')} disabled={disabled} onPress={form.resolve}/>
          </View>
          <View style={styles.sectionHeader}><Text accessibilityRole="header" style={styles.heading}>{t('duplicates.active')}</Text><Text style={styles.badge}>{form.groups.length}</Text></View>
          {!form.groups.length?<Text style={styles.body}>{t('duplicates.noActive')}</Text>:null}
          {form.groups.map((group)=><View key={group.id} testID={`duplicate-group-${group.id}`} style={styles.card}>
            <Text style={styles.label}>{t('duplicates.canonicalSummary',{id:short(group.canonical_report_id)})}</Text>
            <Text selectable style={styles.caption}>ID: {group.id}</Text>
            <Text style={styles.body}>{t('duplicates.members')}</Text>
            {group.report_ids.map((id)=><Text key={id} selectable style={styles.caption}>{id}{id===group.canonical_report_id?` · ${t('duplicates.canonicalChosen')}`:''}</Text>)}
            <Text style={styles.caption}>{t('duplicates.resolutionVersion',{version:group.resolution_version})}</Text>
            <Button secondary testID={`duplicate-reverse-${group.id}`} title={t('duplicates.reverse')} onPress={()=>form.openReverse(group.id)} disabled={disabled}/>
          </View>)}
        </>:null}
      </ScrollView>
      {ready && form.ids.length > 0 && !busy ? <View style={styles.selectionFooter}>
        {form.selectionError ? <Text accessibilityRole="alert" style={styles.errorText}>{t('duplicates.selectionWarning')}</Text> : null}
        <Button secondary title={t('duplicates.reviewSelection',{count:form.ids.length})} onPress={()=>scroll.current?.scrollTo({y:summaryY.current,animated:true})}/>
      </View> : null}
      {busy?<View style={styles.progress} accessibilityLiveRegion="polite"><ActivityIndicator color={colors.primary}/><Text style={styles.caption}>{t(`duplicates.busy.${form.busy}`)}</Text></View>:null}
    </KeyboardAvoidingView>
    <Modal visible={Boolean(reverseGroup)} transparent animationType="fade" onRequestClose={form.closeReverse}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS==='ios'?'padding':undefined}><View style={styles.modal} accessibilityViewIsModal>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalContent}>
          <Text accessibilityRole="header" style={styles.heading}>{t('duplicates.reverse')}</Text>
          <Text style={styles.body}>{t('duplicates.reverseHelp')}</Text>
          {reverseGroup?<Text selectable style={styles.caption}>ID: {reverseGroup.id}</Text>:null}
          {form.error?<Text accessibilityRole="alert" style={styles.errorText}>{generalError}</Text>:null}
          <Note inputRef={reason} testID="duplicate-reverse-note" value={form.reverseNote} onChange={form.changeReverseNote} label={t('duplicates.reverseNote')} error={form.errors.note} disabled={disabled} t={t}/>
          <Button testID="duplicate-confirm-reverse" title={t('duplicates.confirmReverse')} disabled={disabled} onPress={form.reverse}/>
          <Button secondary title={t('common.cancel')} disabled={busy} onPress={form.closeReverse}/>
        </ScrollView>
      </View></KeyboardAvoidingView>
    </Modal>
    <Modal visible={Boolean(navigation)} transparent animationType="fade" onRequestClose={()=>setNavigation(null)}>
      <View style={styles.backdrop}><View style={styles.modal}><View style={styles.modalContent}>
        <Text style={styles.heading}>{t('duplicates.discardTitle')}</Text><Text style={styles.body}>{t('duplicates.discardBody')}</Text>
        <Button secondary title={t('configuration.keepEditing')} onPress={()=>setNavigation(null)}/>
        <Button title={t('configuration.discard')} onPress={()=>{const action=navigation;setNavigation(null);if(action==='back')onBack?.();else form.reload();}}/>
      </View></View></View>
    </Modal>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  flex:{flex:1},safe:{flex:1,backgroundColor:colors.background},content:{width:'100%',maxWidth:920,alignSelf:'center',padding:20,paddingBottom:40,gap:18},
  hero:{gap:10},eyebrow:{color:colors.primary,fontFamily:'PlusJakartaSans_700Bold',fontSize:11,letterSpacing:1.5,textTransform:'uppercase'},
  title:{color:colors.ink,fontFamily:'PlusJakartaSans_700Bold',fontSize:29,lineHeight:37},heading:{color:colors.ink,fontFamily:'PlusJakartaSans_700Bold',fontSize:19,lineHeight:27,flexShrink:1},
  body:{color:colors.muted,fontFamily:'PlusJakartaSans_400Regular',fontSize:14,lineHeight:22},caption:{color:colors.muted,fontFamily:'PlusJakartaSans_400Regular',fontSize:12,lineHeight:19},label:{color:colors.ink,fontFamily:'PlusJakartaSans_700Bold',fontSize:14,lineHeight:22,flexShrink:1},
  card:{backgroundColor:'#fff',padding:18,borderRadius:18,borderWidth:1,borderColor:'#e0e6db',gap:14},report:{borderWidth:1,borderColor:colors.border,borderRadius:12,padding:14,gap:8},selected:{backgroundColor:'#f0faed',borderColor:colors.primary},
  sectionHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},badge:{color:colors.primary,fontFamily:'PlusJakartaSans_700Bold',backgroundColor:colors.soft,borderRadius:20,padding:8},
  selection:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:10,minHeight:48},marker:{fontSize:22,color:colors.primary},canonical:{minHeight:44,justifyContent:'center',borderTopWidth:1,borderColor:colors.border,paddingTop:8},canonicalText:{color:colors.primary,fontFamily:'PlusJakartaSans_700Bold',fontSize:13,lineHeight:21},
  field:{gap:8},input:{backgroundColor:'#fcfdf9',borderWidth:1,borderColor:colors.border,borderRadius:10,padding:12,minHeight:100,maxHeight:180,fontSize:16,fontFamily:'PlusJakartaSans_400Regular',color:colors.ink},inputError:{borderColor:colors.danger,borderWidth:2},
  errorText:{color:colors.danger,fontFamily:'PlusJakartaSans_400Regular',fontSize:13,lineHeight:21},errorBanner:{backgroundColor:'#fff0ee',padding:16,borderRadius:12,gap:10},success:{backgroundColor:colors.soft,padding:16,borderRadius:12,gap:8},
  button:{backgroundColor:colors.primary,minHeight:48,paddingHorizontal:16,paddingVertical:13,borderRadius:12,alignItems:'center',justifyContent:'center'},buttonText:{color:'#fff',fontFamily:'PlusJakartaSans_700Bold',fontSize:14,textAlign:'center'},secondary:{backgroundColor:'#fff',borderWidth:1,borderColor:colors.border},secondaryText:{color:colors.primary},disabled:{opacity:0.5},pressed:{opacity:0.8},
  selectionFooter:{padding:12,gap:8,backgroundColor:'#fff',borderTopWidth:1,borderColor:colors.border},
  progress:{flexDirection:'row',gap:10,padding:12,justifyContent:'center',backgroundColor:'#fff'},backdrop:{flex:1,backgroundColor:'rgba(17,25,15,0.55)',padding:24,alignItems:'center',justifyContent:'center'},modal:{width:'100%',maxWidth:480,maxHeight:'90%',backgroundColor:'#fff',borderRadius:20},modalContent:{padding:24,gap:16},
});

# Candidate-only unit-level 1PL/2PL calibration. Requires screened server exports.
args <- commandArgs(trailingOnly=TRUE)
if(length(args)<2) stop('Usage: Rscript calibrate.R PREPARED_DIR OUTPUT_DIR')
if(!requireNamespace('mirt',quietly=TRUE)||!requireNamespace('jsonlite',quietly=TRUE)) stop('Install mirt and jsonlite before fitting.')
suppressPackageStartupMessages(library(mirt))
manifest <- jsonlite::fromJSON(file.path(args[1],'manifest.json'),simplifyVector=FALSE)
if(!isTRUE(manifest$readyForCandidateFit)) stop('Calibration preparation did not pass screening.')
if(!requireNamespace('digest',quietly=TRUE)) stop('Install digest to verify the prepared matrix.')
expected_hash <- manifest$matrixArtifact$sha256
if(is.null(expected_hash)||!identical(expected_hash,digest::digest(file=file.path(args[1],'responses.csv'),algo='sha256'))) stop('Response matrix hash does not match the manifest. Re-export the analysis before fitting.')
dir.create(args[2],recursive=TRUE,showWarnings=FALSE)
d <- read.csv(file.path(args[1],'responses.csv'),check.names=FALSE,na.strings=c('','NA'))
persons <- d[[1]]; d <- as.matrix(d[,-1,drop=FALSE]); storage.mode(d)<-'numeric'
if(any(!is.na(d)&!d%in%c(0,1))) stop('Responses must be binary or NA.')
# Deterministic person split: the same person is never both training and holdout.
set.seed(20261012)
hold <- sort(sample(seq_len(nrow(d)),max(1,floor(nrow(d)*.2))))
train <- d[-hold,,drop=FALSE]; heldout <- d[hold,,drop=FALSE]
if(any(colSums(!is.na(train))<30)) stop('Training split too sparse for this candidate fit.')
models <- list(); reports <- list()
for(kind in c('1PL','2PL')){
 warnings <- character()
 fit <- tryCatch(withCallingHandlers(mirt(train,1,itemtype=kind,SE=TRUE,verbose=FALSE,quadpts=41,technical=list(NCYCLES=1000),TOL=1e-5),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart('muffleWarning')}),error=function(e)e)
 if(inherits(fit,'error')){reports[[kind]]<-list(status='failed',error=conditionMessage(fit));next}
 models[[kind]]<-fit
 co <- coef(fit,IRTpars=TRUE,simplify=TRUE)$items
 finite <- all(is.finite(co))
 converge <- isTRUE(extract.mirt(fit,'converged'))
 vc <- tryCatch(vcov(fit),error=function(e)NULL)
 se_ok <- !is.null(vc)&&all(is.finite(vc))&&all(diag(vc)>0)
 # S-X2 may be unavailable under adaptive missingness. Report failure, never substitute a passing value.
 fitstat <- tryCatch(as.data.frame(itemfit(fit,fit_stats='S_X2',na.rm=TRUE)),error=function(e)list(unavailable=conditionMessage(e)))
 if(is.data.frame(fitstat)&&'p.S_X2'%in%names(fitstat))fitstat$adjusted_p_S_X2<-p.adjust(fitstat$p.S_X2,method='BH')
 q3 <- tryCatch(residuals(fit,type='Q3',verbose=FALSE),error=function(e)NULL)
 q3_summary <- list(status='unavailable')
 if(!is.null(q3)){
  vals<-q3[upper.tri(q3)]; center<-mean(vals,na.rm=TRUE); adjusted<-q3-center
  pairs<-which(upper.tri(adjusted)&is.finite(adjusted)&adjusted>.2,arr.ind=TRUE)
  q3_summary<-list(status='computed',rawMean=center,maxAdjusted=if(any(is.finite(vals)))max(vals-center,na.rm=TRUE) else NULL,flagThreshold=.2,flaggedPairs=if(nrow(pairs))data.frame(item1=colnames(d)[pairs[,1]],item2=colnames(d)[pairs[,2]],adjustedQ3=adjusted[pairs]) else list(),interpretation='Screening flags require substantive review; sparse coadministration can make residual correlations unstable.')
 }
 # Predict each held-out item from posterior information in that person's other responses.
 # This avoids grading predictions using a posterior that already includes the target response.
 grid <- seq(-4,4,length.out=81); prior <- dnorm(grid);prior<-prior/sum(prior)
 P<-sapply(seq_len(nrow(co)),function(j)co[j,'g']+(co[j,'u']-co[j,'g'])*plogis(co[j,'a']*(grid-co[j,'b'])))
 logloss<-numeric();brier<-numeric();predictions<-numeric();observations<-numeric()
 for(i in seq_len(nrow(heldout))){obs<-which(!is.na(heldout[i,]));if(length(obs)<2)next
  for(j in obs){other<-setdiff(obs,j);lw<-log(prior)
   for(k in other)lw<-lw+if(heldout[i,k]==1)log(pmax(P[,k],1e-12)) else log(pmax(1-P[,k],1e-12))
   w<-exp(lw-max(lw));w<-w/sum(w);p<-sum(w*P[,j]);y<-heldout[i,j]
   predictions<-c(predictions,p);observations<-c(observations,y);logloss<-c(logloss,-(y*log(pmax(p,1e-12))+(1-y)*log(pmax(1-p,1e-12))));brier<-c(brier,(p-y)^2)
  }
 }
 bins<-cut(predictions,breaks=seq(0,1,.1),include.lowest=TRUE)
 curve<-if(length(predictions))aggregate(data.frame(predicted=predictions,observed=observations),list(bin=bins),mean) else list()
 parameters<-lapply(seq_len(nrow(co)),function(j)list(a=unname(co[j,'a']),b=unname(co[j,'b']),c=unname(co[j,'g']),d=unname(co[j,'u'])))
 names(parameters)<-rownames(co)
 reports[[kind]]<-list(status='candidate',converged=converge,finiteParameters=finite,positiveFiniteCovarianceDiagonal=se_ok,warnings=unique(warnings),AIC=extract.mirt(fit,'AIC'),BIC=extract.mirt(fit,'BIC'),itemFit=fitstat,localDependence=q3_summary,holdout=list(persons=length(hold),predictions=length(predictions),leaveOneItemOutLogLoss=if(length(logloss))mean(logloss) else NULL,brier=if(length(brier))mean(brier) else NULL,calibrationCurve=curve),extremeItems=rownames(co)[co[,'a']<.25|co[,'a']>3|abs(co[,'b'])>4],items=parameters)
 saveRDS(fit,file.path(args[2],paste0(kind,'-candidate.rds')))
}
output<-list(schemaVersion=1,status='candidate',synthetic=isTRUE(manifest$synthetic),approvalRequired=TRUE,course=manifest$course,unit=manifest$unit,bankVersion=manifest$bankVersion,sourceSHA256=manifest$sourceSHA256,matrixSHA256=expected_hash,seed=20261012,trainingPersons=nrow(train),holdoutPersons=nrow(heldout),models=reports,unresolved=c('Substantive item and family review','Dimensionality and testlet model comparison','DIF requires suitable voluntarily supplied group data and anchors','CAT operating-characteristic simulation','External validity and score interpretation','Instructor approval'),software=list(R=R.version.string,mirt=as.character(packageVersion('mirt'))))
jsonlite::write_json(output,file.path(args[2],'candidate-report.json'),auto_unbox=TRUE,pretty=TRUE,na='null',null='null',digits=10)
cat('Candidate reports written; no model approved.\n')

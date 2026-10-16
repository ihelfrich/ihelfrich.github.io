args<-commandArgs(trailingOnly=TRUE)
if(length(args)<2)stop('Usage: Rscript dimensionality.R PREPARED_DIR OUTPUT_DIR')
suppressPackageStartupMessages(library(mirt))
manifest<-jsonlite::fromJSON(file.path(args[1],'manifest.json'))
if(!isTRUE(manifest$readyForCandidateFit))stop('Prepared data failed screening.')
d<-read.csv(file.path(args[1],'responses.csv'),check.names=FALSE,na.strings=c('','NA'));x<-as.matrix(d[,-1,drop=FALSE]);storage.mode(x)<-'numeric'
if(ncol(x)<8)stop('At least eight usable items required for this exploratory comparison.')
dir.create(args[2],recursive=TRUE,showWarnings=FALSE)
reports<-list()
for(k in 1:2){set.seed(20261012);fit<-tryCatch(mirt(x,k,itemtype='2PL',method='EM',quadpts=if(k==1)41 else 21,SE=TRUE,verbose=FALSE,technical=list(NCYCLES=1500)),error=function(e)e)
 if(inherits(fit,'error')){reports[[as.character(k)]]<-list(status='unavailable',reason=conditionMessage(fit));next}
 reports[[as.character(k)]]<-list(status='candidate',converged=isTRUE(extract.mirt(fit,'converged')),AIC=extract.mirt(fit,'AIC'),BIC=extract.mirt(fit,'BIC'),logLik=as.numeric(logLik(fit)))
 saveRDS(fit,file.path(args[2],paste0('dimensions-',k,'.rds')))
}
families<-vapply(manifest$itemStats[manifest$items],function(i)i$family,character(1));coadmin<-crossprod(!is.na(x));within<-outer(families,families,'==')&upper.tri(coadmin)
testable<-sum(within & coadmin>=100)
jsonlite::write_json(list(status='review-required',synthetic=isTRUE(manifest$synthetic),bankVersion=manifest$bankVersion,sourceSHA256=manifest$sourceSHA256,exploratoryModels=reports,testlet=list(coadministeredSiblingPairs=testable,status=if(testable==0)'not-identifiable-from-this-design' else 'requires-specified-testlet-model',reason='First-family-exposure sampling intentionally prevents sibling coadministration. No fitted testlet model is claimed without identifying observations.'),interpretation='Exploratory information criteria are evidence for review, not proof of a construct or authority to combine course scales.'),file.path(args[2],'dimensionality-report.json'),auto_unbox=TRUE,pretty=TRUE,na='null')

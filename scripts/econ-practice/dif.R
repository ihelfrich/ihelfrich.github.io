# Optional, explicitly consented grouping analysis. Never infers a protected attribute.
args<-commandArgs(trailingOnly=TRUE)
if(length(args)<4)stop('Usage: Rscript dif.R PREPARED_DIR GROUPS.csv ANCHORS.txt OUTPUT.json')
suppressPackageStartupMessages(library(mirt))
manifest<-jsonlite::fromJSON(file.path(args[1],'manifest.json'))
if(!isTRUE(manifest$readyForCandidateFit))stop('Prepared data failed screening.')
d<-read.csv(file.path(args[1],'responses.csv'),check.names=FALSE,na.strings=c('','NA'))
g<-read.csv(args[2],stringsAsFactors=FALSE)
if(!all(c('person','group','consented')%in%names(g)))stop('Groups need person, group and consented columns.')
if(anyDuplicated(g$person))stop('Duplicate group records.')
g<-g[g$consented%in%c(TRUE,'true',1),,drop=FALSE]
joined<-match(d$person,g$person);keep<-!is.na(joined)
group<-factor(g$group[joined[keep]])
groupLabels<-levels(group);levels(group)<-paste0('G',seq_along(groupLabels))
x<-as.matrix(d[keep,-1,drop=FALSE]);storage.mode(x)<-'numeric'
if(nlevels(group)<2||any(table(group)<200))stop('At least two groups with 200 consented persons each are required for screening; adequate power still needs simulation.')
anchors<-trimws(readLines(args[3]));anchors<-anchors[nzchar(anchors)]
if(length(anchors)<3||any(!anchors%in%colnames(x)))stop('Specify at least three valid, substantively reviewed anchor items.')
if(length(setdiff(colnames(x),anchors))<1)stop('At least one non-anchor item is required.')
base<-multipleGroup(x,1,group=group,itemtype='2PL',invariance=c(anchors,'free_means','free_var'),SE=TRUE,verbose=FALSE,technical=list(NCYCLES=1500))
if(!isTRUE(extract.mirt(base,'converged')))stop('Multiple-group baseline failed to converge.')
result<-as.data.frame(DIF(base,c('a1','d'),scheme='add',items2test=setdiff(colnames(x),anchors),p.adjust='BH',verbose=FALSE))
result$item<-rownames(result)
jsonlite::write_json(list(status='review-required',synthetic=isTRUE(manifest$synthetic),bankVersion=manifest$bankVersion,sourceSHA256=manifest$sourceSHA256,groupCounts=as.list(table(group)),groupLabelMap=as.list(setNames(groupLabels,levels(group))),anchors=anchors,tests=result,interpretation='Conditional parameter differences are statistical flags, not findings of bias. Anchor contamination, power, effect size and substantive explanations require review.'),args[4],pretty=TRUE,auto_unbox=TRUE,na='null')

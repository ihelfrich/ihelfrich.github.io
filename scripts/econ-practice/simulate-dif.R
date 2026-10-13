args<-commandArgs(trailingOnly=TRUE);out<-if(length(args))args[1] else '.local/econ-calibration/synthetic-dif'
dir.create(out,recursive=TRUE,showWarnings=FALSE)
set.seed(20261012)
N<-500;J<-12;a<-rep(1.2,J);b<-seq(-2,2,length.out=J)
group<-rep(c('synthetic-A','synthetic-B'),each=N);theta<-c(rnorm(N),rnorm(N,.4,1.1))
x<-matrix(NA_integer_,2*N,J);colnames(x)<-paste0('item-',seq_len(J))
for(i in seq_len(2*N))for(j in seq_len(J)){offset<-if(group[i]=='synthetic-B'&&j==10)1.4 else 0;x[i,j]<-rbinom(1,1,plogis(a[j]*(theta[i]-b[j]-offset)))}
person<-paste0('synthetic-person-',seq_len(2*N))
write.csv(data.frame(person=person,x,check.names=FALSE),file.path(out,'responses.csv'),row.names=FALSE)
write.csv(data.frame(person=person,group=group,consented=TRUE),file.path(out,'groups.csv'),row.names=FALSE)
writeLines(colnames(x)[1:4],file.path(out,'anchors.txt'))
jsonlite::write_json(list(readyForCandidateFit=TRUE,synthetic=TRUE,bankVersion='synthetic',sourceSHA256='synthetic-dif-fixture',items=colnames(x)),file.path(out,'manifest.json'),auto_unbox=TRUE,pretty=TRUE)
cat('Synthetic DIF fixture: item-10 has a 1.4 difficulty shift; group B also has a different latent distribution.\n')

package com.healthcare;

import org.apache.hadoop.conf.Configuration;
import org.apache.hadoop.fs.Path;
import org.apache.hadoop.io.LongWritable;
import org.apache.hadoop.io.Text;
import org.apache.hadoop.mapreduce.Job;
import org.apache.hadoop.mapreduce.Mapper;
import org.apache.hadoop.mapreduce.Reducer;
import org.apache.hadoop.mapreduce.lib.input.FileInputFormat;
import org.apache.hadoop.mapreduce.lib.output.FileOutputFormat;

import java.io.IOException;

public class ReadmissionRates {

    public static class ReadmissionMapper extends Mapper<LongWritable, Text, Text, Text> {
        private Text regionKey = new Text();
        private Text readmitValue = new Text();

        public void map(LongWritable key, Text value, Context context) throws IOException, InterruptedException {
            if (key.get() == 0 && value.toString().contains("patient_id")) {
                return;
            }
            
            String[] fields = value.toString().split(",");
            if (fields.length >= 9) {
                String region = fields[3];
                String disease = fields[5];
                String readmitted = fields[8]; // "Yes" or "No"
                
                regionKey.set(region + "|" + disease);
                // Value is "1,1" if readmitted, "1,0" if not (Total, ReadmittedCount)
                if ("Yes".equalsIgnoreCase(readmitted)) {
                    readmitValue.set("1,1");
                } else {
                    readmitValue.set("1,0");
                }
                context.write(regionKey, readmitValue);
            }
        }
    }

    public static class ReadmissionReducer extends Reducer<Text, Text, Text, Text> {
        private Text result = new Text();

        public void reduce(Text key, Iterable<Text> values, Context context) throws IOException, InterruptedException {
            int total = 0;
            int readmitted = 0;
            
            for (Text val : values) {
                String[] parts = val.toString().split(",");
                total += Integer.parseInt(parts[0]);
                readmitted += Integer.parseInt(parts[1]);
            }
            
            double rate = (double) readmitted / total;
            result.set(String.format("%d,%d,%.4f", total, readmitted, rate));
            context.write(key, result);
        }
    }

    public static void main(String[] args) throws Exception {
        Configuration conf = new Configuration();
        Job job = Job.getInstance(conf, "Readmission Rates");
        job.setJarByClass(ReadmissionRates.class);
        job.setMapperClass(ReadmissionMapper.class);
        job.setReducerClass(ReadmissionReducer.class);
        job.setOutputKeyClass(Text.class);
        job.setOutputValueClass(Text.class);
        
        FileInputFormat.addInputPath(job, new Path(args[0]));
        FileOutputFormat.setOutputPath(job, new Path(args[1]));
        
        System.exit(job.waitForCompletion(true) ? 0 : 1);
    }
}
